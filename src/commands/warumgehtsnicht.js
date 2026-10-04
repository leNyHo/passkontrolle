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
  );

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
  // 2. Prüfung: Ziel-Nutzer Rechte & Freigeschaltete Rolle
  // ==========================================
  if (targetMember) {
    const userChannelPerms = channel.permissionsFor(targetMember);
    const userIsOwner = guild.ownerId === targetMember.id;
    const userIsAdmin = targetMember.permissions.has(PermissionFlagsBits.Administrator);
    const userCanView = userChannelPerms.has(PermissionFlagsBits.ViewChannel);
    const userCanUseCommands = userChannelPerms.has(PermissionFlagsBits.UseApplicationCommands);

    const hasAllowedRole = Boolean(
      settings.allowed_role_id && (
        targetMember.roles?.cache?.has(settings.allowed_role_id) ||
        (Array.isArray(targetMember.roles) && targetMember.roles.includes(settings.allowed_role_id))
      )
    );

    if (userIsOwner) {
      checks.push(`✅ **${targetUser.username} ist Server-Owner:** Voller Zugriff auf alle Befehle.`);
    } else if (userIsAdmin) {
      checks.push(`✅ **${targetUser.username} ist Administrator:** Voller Zugriff auf alle Befehle.`);
    } else if (hasAllowedRole) {
      checks.push(`✅ **${targetUser.username} hat die freigeschaltete Rolle <@&${settings.allowed_role_id}>:** Voller Zugriff auf den Bot.`);
    } else {
      if (settings.allowed_role_id) {
        issues.push(
          `🚨 **${targetUser.username} fehlt die freigeschaltete Rolle:**\n` +
          `> Auf diesem Server ist die Rolle <@&${settings.allowed_role_id}> für den Bot hinterlegt.\n` +
          `> ${targetUser.username} hat diese Rolle jedoch aktuell **nicht** zugewiesen!`
        );
      } else {
        issues.push(
          `🚨 **Keine Rolle für den Bot freigeschaltet:**\n` +
          `> ${targetUser.username} hat keine Server-Administrator-Rechte und es wurde noch keine Rolle freigegeben.\n` +
          `> **Lösung (ohne Admin-Rechte):** Der Server-Owner/Admin kann mit \`/erlauberolle @Rolle\` eine Rolle (z.B. Co-Leader) für den Bot freischalten!`
        );
      }
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

  if (settings.allowed_role_id) {
    checks.push(`✅ **Freigeschaltete Rolle eingerichtet:** <@&${settings.allowed_role_id}>`);
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
          '1. **Befehle ohne Admin-Rechte freischalten:**\n' +
          '   Führe `/erlauberolle @Rolle` aus, um z. B. der Rolle @Co-Leader vollen Zugriff auf den Bot zu geben.\n' +
          '2. **Discord Client-Cache:**\n' +
          '   Nach Rollenänderungen muss der Nutzer in Discord **STRG + R** (Mac: **CMD + R**) drücken, falls Befehle noch nicht sofort im Menü sichtbar sind!',
        inline: false
      }
    )
    .setFooter({ text: 'Clash Royale Admin Bot • Selbstdiagnose' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
