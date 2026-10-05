import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getGuildSettings } from '../services/database.js';
import { COLORS } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('wasistdasproblem')
  .setDescription('Diagnose-Tool: Prüft Berechtigungen, Kanalrechte und Rollen für den Bot.')
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('Optional: Bestimmten Nutzer prüfen, der den Bot nicht nutzen kann')
      .setRequired(false)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();
  } catch (e) {
    console.error('deferReply failed:', e);
  }

  try {
    let guild = interaction.guild;
    if (!guild && interaction.guildId) {
      guild = await interaction.client.guilds.fetch(interaction.guildId).catch(() => null);
    }

    if (!guild) {
      if (interaction.guildId) {
        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${interaction.client.user.id}&permissions=8&integration_type=0&scope=bot+applications.commands`;
        return await interaction.editReply({
          content:
            `🚨 **Hauptproblem gefunden: Der Bot ist diesem Discord-Server noch nicht als Server-Bot beigetreten!**\n\n` +
            `> **Warum passiert das?**\n` +
            `> Der Bot wurde vermutlich nur zu deinem persönlichen Account oder dem Account deines Kumpels als *Benutzer-App (User App)* hinzugefügt, ` +
            `befindet sich aber **nicht als vollwertiges Mitglied auf diesem Server**!\n` +
            `> Deshalb siehst du ihn **nicht in der rechten Mitgliederliste** und der Bot hat keinen Zugriff auf Server-Rollen oder Kanäle.\n\n` +
            `👉 **Lösung (dauert 10 Sekunden):**\n` +
            `Der Server-Owner (dein Kumpel) muss den Bot über folgenden Einladungslink auf den Server einladen:\n\n` +
            `🔗 **[Hier klicken: Bot auf den Server einladen](${inviteUrl})**\n\n` +
            `*(Wähle im Browser den Server aus und klicke auf "Autorisieren". Sobald der Bot rechts in der Mitgliederliste auftaucht, funktioniert alles sofort!)*`
        });
      } else {
        return await interaction.editReply({
          content: '❌ **Dieser Befehl kann nur auf einem Discord-Server (in einem Textkanal) ausgeführt werden, nicht in Direktnachrichten (DMs).**'
        });
      }
    }

    const channel = interaction.channel;
    const targetUser = interaction.options.getUser('user') || interaction.user;

    // Bot-Member & Ziel-Member sicher abrufen
    const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

    const settings = getGuildSettings(guild.id);
    const issues = [];
    const checks = [];

    // ==========================================
    // 1. Prüfung: Bot ist Server-Mitglied
    // ==========================================
    checks.push(`✅ **Bot ist Server-Mitglied:** Befindet sich auf Server "${guild.name}" (ID: \`${guild.id}\`).`);

    // ==========================================
    // 2. Prüfung: Bot-Rechte im aktuellen Kanal
    // ==========================================
    const botChannelPerms = botMember && channel?.permissionsFor ? channel.permissionsFor(botMember) : null;
    const botCanView = botChannelPerms ? botChannelPerms.has(PermissionFlagsBits.ViewChannel) : true;
    const botCanSend = botChannelPerms ? botChannelPerms.has(PermissionFlagsBits.SendMessages) : true;
    const botCanEmbed = botChannelPerms ? botChannelPerms.has(PermissionFlagsBits.EmbedLinks) : true;

    if (!botCanView) {
      issues.push('❌ **Bot kann diesen Kanal nicht sehen:** Der Bot benötigt Leserechte für diesen Textkanal.');
    } else {
      checks.push('✅ **Bot hat Kanalzugriff:** Er kann diesen Textkanal sehen.');
    }

    if (!botCanSend || !botCanEmbed) {
      issues.push('❌ **Bot fehlen Schreib-/Embed-Rechte:** Der Bot benötigt "Nachrichten senden" und "Links einbetten" in diesem Kanal.');
    } else {
      checks.push('✅ **Bot kann Nachrichten & Embeds senden.**');
    }

    // ==========================================
    // 3. Prüfung: Ziel-Nutzer Rechte & Rollen
    // ==========================================
    if (targetMember) {
      const userChannelPerms = channel?.permissionsFor ? channel.permissionsFor(targetMember) : null;
      const userIsOwner = guild.ownerId === targetMember.id;
      const userIsAdmin = targetMember.permissions?.has ? targetMember.permissions.has(PermissionFlagsBits.Administrator) : false;
      const userCanView = userChannelPerms ? userChannelPerms.has(PermissionFlagsBits.ViewChannel) : true;
      const userCanUseCommands = userChannelPerms ? userChannelPerms.has(PermissionFlagsBits.UseApplicationCommands) : true;

      const hasAllowedRole = Boolean(
        settings.allowed_role_id && (
          targetMember.roles?.cache?.has(settings.allowed_role_id) ||
          (Array.isArray(targetMember.roles) && targetMember.roles.includes(settings.allowed_role_id))
        )
      );

      if (userIsOwner) {
        checks.push(`✅ **${targetUser.username} ist Server-Owner:** Voller Zugriff auf alle Befehle.`);
      } else if (userIsAdmin) {
        checks.push(`✅ **${targetUser.username} ist Discord-Administrator:** Voller Zugriff auf alle Befehle.`);
      } else if (hasAllowedRole) {
        checks.push(`✅ **${targetUser.username} hat die freigeschaltete Rolle <@&${settings.allowed_role_id}>:** Voller Zugriff auf alle Bot-Befehle.`);
      } else {
        issues.push(
          `🚨 **${targetUser.username} hat noch keine Nutzungsberechtigung!**\n` +
          `> 👉 **Lösung:** Ein Server-Admin kann mit \`/erlauberolle @Rolle\` deine Rolle freischalten oder dir Discord-Administrator-Rechte erteilen.`
        );
      }

      if (!userCanView) {
        issues.push(`❌ **${targetUser.username} kann diesen Kanal nicht sehen:** Nutzer hat keine Leserechte für <#${channel.id}>.`);
      }

      if (!userCanUseCommands) {
        issues.push(`❌ **Slash-Commands blockiert:** Die Berechtigung "Anwendungsbefehle verwenden" ist für ${targetUser.username} in diesem Kanal deaktiviert.`);
      }
    }

    // ==========================================
    // 4. Prüfung: Bot-Konfiguration
    // ==========================================
    if (!settings.clan_tag) {
      issues.push('⚠️ **Kein Clan hinterlegt:** Es wurde noch kein Clan mit `/setclan [tag]` verknüpft.');
    } else {
      checks.push(`✅ **Clan hinterlegt:** \`${settings.clan_tag}\``);
    }

    if (!settings.channel_id) {
      issues.push('⚠️ **Kein Report-Kanal:** Es wurde noch kein Zielkanal mit `/setchannel` festgelegt.');
    } else {
      checks.push(`✅ **Report-Kanal hinterlegt:** <#${settings.channel_id}>`);
    }

    if (settings.allowed_role_id) {
      checks.push(`✅ **Zusätzliche Freigabe-Rolle aktiv:** <@&${settings.allowed_role_id}>`);
    }

    // ==========================================
    // Embed zusammenbauen
    // ==========================================
    const hasErrors = issues.length > 0;
    const embed = new EmbedBuilder()
      .setColor(hasErrors ? COLORS.DANGER_RED : COLORS.SUCCESS_GREEN)
      .setTitle(`🔍 Diagnose-Bericht für Server: ${guild.name}`)
      .setDescription(
        `Geprüfter Kanal: <#${channel.id}>\n` +
        `Geprüfter Nutzer: <@${targetUser.id}> (${targetUser.tag})\n` +
        `Server-Owner: <@${guild.ownerId}>\n\n` +
        (hasErrors
          ? '⚠️ **Gefundene Probleme & Lösungen:**\n' + issues.join('\n\n')
          : '🎉 **Alles optimal konfiguriert!** Du hast vollen Zugriff auf den Bot.')
      )
      .addFields(
        {
          name: '📋 Status-Prüfungen',
          value: checks.length > 0 ? checks.join('\n') : 'Keine',
          inline: false
        },
        {
          name: '💡 Nutzung ohne Admin-Rechte',
          value:
            '1. **Rolle freischalten:** Ein Admin führt `/erlauberolle @Rolle` aus (z. B. für @Co-Leader).\n' +
            '2. **Fertig:** Danach können alle Mitglieder mit dieser Rolle alle Befehle des Bots nutzen!',
          inline: false
        }
      )
      .setFooter({ text: 'Clash Royale Bot • Selbstdiagnose' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Fehler in /wasistdasproblem:', err);
    await interaction.editReply({
      content: `❌ **Diagnose-Fehler:** Bei der Diagnose ist ein interner Fehler aufgetreten: \`${err.message}\`. Bitte prüfe die Server-Konsole.`
    }).catch(() => {});
  }
}
