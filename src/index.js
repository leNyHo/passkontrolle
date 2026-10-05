import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  ActivityType,
  PermissionFlagsBits
} from 'discord.js';
import { config, validateConfig } from './config.js';
import { getDatabase, closeDatabase, getGuildSettings } from './services/database.js';
import { initScheduler, stopAllSchedulers, scheduleGuildWarEnd } from './services/scheduler.js';
import { ensurePasskontrollRole, hasPasskontrollRole, ROLE_NAME } from './utils/roles.js';

// Befehle importieren
import * as erlauberolleCommand from './commands/erlauberolle.js';
import * as wasistdasproblemCommand from './commands/wasistdasproblem.js';
import * as angriffeCommand from './commands/angriffe.js';
import * as erinnerungCommand from './commands/erinnerung.js';
import * as verwarnungenCommand from './commands/verwarnungen.js';
import * as setclanCommand from './commands/setclan.js';
import * as setchannelCommand from './commands/setchannel.js';
import * as settimeCommand from './commands/settime.js';
import * as seterinnerungCommand from './commands/seterinnerung.js';
import * as resetstrikesCommand from './commands/resetstrikes.js';
import * as resetallstrikesCommand from './commands/resetallstrikes.js';
import * as helpCommand from './commands/help.js';

console.log('--- Starte Clash Royale Clan-Management Bot ---');
validateConfig();

// SQLite Datenbank initialisieren
getDatabase();

// Discord Client erstellen (reiner Slash-Command Bot, minimale Berechtigungen nötig)
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();
const commandList = [
  erlauberolleCommand,
  wasistdasproblemCommand,
  angriffeCommand,
  erinnerungCommand,
  verwarnungenCommand,
  setclanCommand,
  setchannelCommand,
  settimeCommand,
  seterinnerungCommand,
  resetstrikesCommand,
  resetallstrikesCommand,
  helpCommand
];

const commandsPayload = [];
for (const cmd of commandList) {
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    commandsPayload.push(cmd.data.toJSON());
  }
}

// Slash-Commands bei Discord registrieren
async function registerSlashCommands() {
  if (!config.discordToken || !config.discordClientId) {
    console.warn('[Commands] DISCORD_TOKEN oder DISCORD_CLIENT_ID fehlt. Slash-Commands können nicht registriert werden.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  try {
    console.log(`[Commands] Registriere ${commandsPayload.length} Slash-Commands bei Discord...`);
    
    // 1. Global registrieren
    await rest.put(
      Routes.applicationCommands(config.discordClientId),
      { body: commandsPayload }
    );

    // 2. Direkt pro Server registrieren (erscheinen dadurch sofort ohne Wartezeit)
    for (const guild of client.guilds.cache.values()) {
      await rest.put(
        Routes.applicationGuildCommands(config.discordClientId, guild.id),
        { body: commandsPayload }
      );
      console.log(`[Commands] Sofortige Bereitstellung auf Server "${guild.name}" (${guild.id}) aktiv!`);
    }

    console.log('[Commands] Slash-Commands erfolgreich registriert!');
  } catch (error) {
    console.error('[Commands] Fehler beim Registrieren der Slash-Commands:', error);
  }
}

// Event: Bot ist bereit und eingeloggt
client.once(Events.ClientReady, async (c) => {
  console.log(`[Discord] Eingeloggt als ${c.user.tag} (ID: ${c.user.id})`);
  console.log(`[Discord] Aktiv auf ${c.guilds.cache.size} Server(n).`);

  c.user.setActivity('⚔️[BETA] ES KÖNNEN FEHLER AUFTRETEN⚔️', { type: ActivityType.Custom });

  // Rolle "Passkontroll-User" auf allen Servern sicherstellen
  for (const guild of c.guilds.cache.values()) {
    await ensurePasskontrollRole(guild);
  }

  // Slash-Commands sofort aktualisieren
  await registerSlashCommands();

  // Scheduler für tägliche Kriegsberichte starten
  initScheduler(client);
});

// Event: Neuer Server beigetreten
client.on(Events.GuildCreate, async (guild) => {
  console.log(`[Discord] Neuem Server beigetreten: "${guild.name}" (${guild.id})`);
  await ensurePasskontrollRole(guild);
  scheduleGuildWarEnd(client, guild.id, config.defaultWarEndTime, config.timezone);

  if (config.discordToken && config.discordClientId) {
    try {
      const rest = new REST({ version: '10' }).setToken(config.discordToken);
      await rest.put(
        Routes.applicationGuildCommands(config.discordClientId, guild.id),
        { body: commandsPayload }
      );
      console.log(`[Commands] Sofortige Bereitstellung auf neuem Server "${guild.name}" (${guild.id}) aktiv!`);
    } catch (err) {
      console.warn(`[Commands] Konnte Guild-Commands für "${guild.name}" nicht sofort registrieren:`, err.message);
    }
  }
});

// Event: Interaktion empfangen (Slash Commands)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`Unbekannter Befehl aufgerufen: ${interaction.commandName}`);
    return;
  }

  // Rechteprüfung für Server-Befehle
  if (interaction.guildId) {
    let guild = interaction.guild;
    if (!guild) {
      guild = await interaction.client.guilds.fetch(interaction.guildId).catch(() => null);
    }

    // Diagnose-Befehl ist IMMER für jeden erlaubt
    if (interaction.commandName === 'wasistdasproblem') {
      // Direkt zur Ausführung weiterleiten
    } else if (!guild) {
      // Bot befindet sich nicht als Mitglied auf diesem Server (nur als User-App aufgerufen)
      const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${interaction.client.user.id}&permissions=8&integration_type=0&scope=bot+applications.commands`;
      return await interaction.reply({
        content:
          '🚨 **Der Bot ist diesem Discord-Server noch nicht als Server-Bot beigetreten!**\n\n' +
          'Damit der Bot auf Server-Kanäle, Rollen und Befehle zugreifen kann, muss er vom Server-Owner eingeladen werden:\n' +
          `🔗 **[Hier klicken: Bot auf den Server einladen](${inviteUrl})**\n\n` +
          '*(Tipp: Führe `/wasistdasproblem` aus für weitere Informationen).*',
        ephemeral: true
      });
    } else {
      const isOwner = guild.ownerId === interaction.user.id;
      const isAdmin = Boolean(interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator));
      const userHasPasskontroll = hasPasskontrollRole(interaction.member, guild);

      // 1. /erlauberolle darf von Server-Owner, Discord-Administratoren oder Mitgliedern mit der Rolle "Passkontroll-User" ausgeführt werden
      if (interaction.commandName === 'erlauberolle') {
        if (!isOwner && !isAdmin && !userHasPasskontroll) {
          return await interaction.reply({
            content: `❌ **Keine Berechtigung!** Nur der Server-Owner, Discord-Administratoren oder Nutzer mit der Rolle **${ROLE_NAME}** können berechtigte Rollen festlegen.`,
            ephemeral: true
          });
        }
      } else {
        // 2. Für alle anderen Befehle: Server-Owner, Discord-Admin, Rolle "Passkontroll-User" ODER freigeschaltete Rolle via /erlauberolle
        const settings = getGuildSettings(interaction.guildId);

        const hasAllowedRole = Boolean(
          settings.allowed_role_id && (
            interaction.member?.roles?.cache?.has(settings.allowed_role_id) ||
            (Array.isArray(interaction.member?.roles) && interaction.member.roles.includes(settings.allowed_role_id))
          )
        );

        if (!isOwner && !isAdmin && !userHasPasskontroll && !hasAllowedRole) {
          const deniedMsg =
            '❌ **Keine Berechtigung!**\n\n' +
            `Um diesen Bot zu nutzen, weise dir einfach die Rolle **${ROLE_NAME}** zu (oder bitte einen Admin darum).\n` +
            (settings.allowed_role_id ? `Alternativ ist auch die Rolle <@&${settings.allowed_role_id}> freigeschaltet.\n\n` : '\n') +
            '*(Tipp: Führe `/wasistdasproblem` aus, um deine aktuellen Berechtigungen zu überprüfen).*';

          return await interaction.reply({
            content: deniedMsg,
            ephemeral: true
          });
        }
      }
    }
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Fehler bei Ausführung von /${interaction.commandName}:`, error);

    const errorMessage = {
      content: '❌ **Beim Ausführen dieses Befehls ist ein interner Fehler aufgetreten!**',
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(errorMessage).catch(() => {});
    } else {
      await interaction.reply(errorMessage).catch(() => {});
    }
  }
});

// Graceful Shutdown Handler
function shutdown() {
  console.log('\n[Bot] Fahre Bot ordnungsgemäß herunter...');
  stopAllSchedulers();
  closeDatabase();
  client.destroy();
  console.log('[Bot] Beendet.');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Bot einloggen
if (config.discordToken) {
  client.login(config.discordToken).catch((err) => {
    console.error('[Discord] Login fehlgeschlagen:', err.message);
  });
} else {
  console.warn('[Discord] Kein DISCORD_TOKEN in der Konfiguration vorhanden. Bitte .env anpassen.');
}
