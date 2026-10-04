import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getGuildSettings } from '../services/database.js';
import { COLORS } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('warumgehtsnicht')
  .setDescription('Diagnose-Tool: Prüft Berechtigungen, Kanalrechte und Rollen für den Bot.')
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('Optional: Bestimmten Nutzer prüfen, der den Bot nicht sieht oder nicht nutzen kann')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  await interaction.deferReply();

  const guild = interaction.guild;
  const channel = interaction.channel;
  const botMember = guild.members.me;
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  const settings = getGuildSettings(guild.id);
  const issues = [];
  const checks = [];

  // ==========================================
  // 1. Prüfung: Bot-Rechte im aktuellen Kanal
  // ==========================================
  const botChannelPerms = channel.permissionsFor(botMember);
  const botCanView = botChannelPerms.has(PermissionFlagsBits.ViewChannel);
  const botCanSend = botChannelPerms.has(PermissionFlagsBits.SendMessages);
  const botCanEmbed = botChannelPerms.has(PermissionFlagsBits.EmbedLinks);
  const botIsAdmin = botMember.permissions.has(PermissionFlagsBits.Administrator);

  if (!botCanView) {
    issues.push('❌ **Bot kann diesen Kanal nicht sehen:** Deshalb taucht der Bot in der rechten Mitgliederliste dieses Kanals NICHT auf.');
  } else {
    checks.push('✅ **Bot hat Kanalzugriff:** Er kann diesen Textkanal sehen.');
  }

  if (!botCanSend || !botCanEmbed) {
    issues.push('❌ **Bot fehlen Schreib-/Embed-Rechte:** Der Bot benötigt "Nachrichten senden" und "Links einbetten" in diesem Kanal.');
  } else {
    checks.push('✅ **Bot kann Nachrichten & Embeds senden.**');
  }

  // ==========================================
  // 2. Prüfung: Ziel-Nutzer Rechte
  // ==========================================
  if (targetMember) {
    const userChannelPerms = channel.permissionsFor(targetMember);
    const userIsOwner = guild.ownerId === targetMember.id;
    const userIsAdmin = targetMember.permissions.has(PermissionFlagsBits.Administrator);
    const userCanView = userChannelPerms.has(PermissionFlagsBits.ViewChannel);
    const userCanUseCommands = userChannelPerms.has(PermissionFlagsBits.UseApplicationCommands);

    if (!userIsAdmin && !userIsOwner) {
      issues.push(
        `🚨 **${targetUser.username} hat KEINE Discord-Administrator-Berechtigung!**\n` +
        `> **Hauptursache:** Alle Slash-Commands dieses Bots sind standardmäßig mit \`Administrator\` geschützt. ` +
        `Discord blendet diese Befehle für ${targetUser.username} **vollständig aus**!\n` +
        `> **Lösung A:** Gib ${targetUser.username} eine Rolle mit der Berechtigung *Administrator*.\n` +
        `> **Lösung B (Empfohlen ohne Admin-Rechte):** Öffne *Server-Einstellungen ➔ Integrationen ➔ Bots & Apps ➔ [Bot]* und schalte die Rolle von ${targetUser.username} für die Befehle frei!`
      );
    } else {
      checks.push(`✅ **${targetUser.username} ist Administrator:** Sieht standardmäßig alle Admin-Befehle.`);
    }

    if (!userCanView) {
      issues.push(`❌ **${targetUser.username} kann diesen Kanal nicht sehen:** Nutzer hat keine Leserechte für <#${channel.id}>.`);
    }

    if (!userCanUseCommands) {
      issues.push(`❌ **Slash-Commands blockiert:** Die Berechtigung "Anwendungsbefehle verwenden" ist für ${targetUser.username} in diesem Kanal deaktiviert.`);
    }
  }

  // ==========================================
  // 3. Prüfung: Bot-Konfiguration
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
        ? '⚠️ **Gefundene Probleme & Ursachen:**\n' + issues.join('\n\n')
        : '🎉 **Alles optimal konfiguriert!** Es wurden keine Berechtigungskonflikte gefunden.')
    )
    .addFields(
      {
        name: '📋 Erfolgreiche Prüfungen',
        value: checks.length > 0 ? checks.join('\n') : 'Keine',
        inline: false
      },
      {
        name: '💡 Schnellanleitung für den Server-Owner',
        value:
          '1. **Befehle für Nicht-Admins freischalten:**\n' +
          '   `Server-Einstellungen` ➔ `Integrationen` ➔ `Bots & Apps` ➔ diesen Bot anklicken.\n' +
          '   Dort kannst du Rollen (z. B. Co-Leader) explizit aktivieren, ohne ihnen volle Server-Admin-Rechte geben zu müssen.\n' +
          '2. **Discord Client-Cache:**\n' +
          '   Nach Rollenänderungen muss der Nutzer in Discord **STRG + R** (Mac: **CMD + R**) drücken!',
        inline: false
      }
    )
    .setFooter({ text: 'Clash Royale Admin Bot • Selbstdiagnose' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
