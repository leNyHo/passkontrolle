import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  ActivityType
} from 'discord.js';
import { config, validateConfig } from './config.js';
import { getDatabase, closeDatabase } from './services/database.js';
import { initScheduler, stopAllSchedulers } from './services/scheduler.js';

// Befehle importieren
import * as angriffeCommand from './commands/angriffe.js';
import * as erinnerungCommand from './commands/erinnerung.js';
import * as verwarnungenCommand from './commands/verwarnungen.js';
import * as setclanCommand from './commands/setclan.js';
import * as setchannelCommand from './commands/setchannel.js';
import * as settimeCommand from './commands/settime.js';
import * as setwarningCommand from './commands/setwarning.js';
import * as seterinnerungCommand from './commands/seterinnerung.js';
import * as resetstrikesCommand from './commands/resetstrikes.js';
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
  angriffeCommand,
  erinnerungCommand,
  verwarnungenCommand,
  setclanCommand,
  setchannelCommand,
  settimeCommand,
  setwarningCommand,
  seterinnerungCommand,
  resetstrikesCommand,
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
    console.log(`[Commands] Registriere ${commandsPayload.length} globale Slash-Commands bei Discord...`);
    await rest.put(
      Routes.applicationCommands(config.discordClientId),
      { body: commandsPayload }
    );
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

  // Slash-Commands aktualisieren
  await registerSlashCommands();

  // Scheduler für tägliche Kriegsberichte starten
  initScheduler(client);
});

// Event: Interaktion empfangen (Slash Commands)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`Unbekannter Befehl aufgerufen: ${interaction.commandName}`);
    return;
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
