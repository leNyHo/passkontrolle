import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { saveGuildSettings } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('erlauberolle')
  .setDescription('Erlaubt einer bestimmten Rolle, alle Befehle des Bots zu nutzen (auch ohne Admin-Rechte).')
  .addRoleOption((option) =>
    option
      .setName('rolle')
      .setDescription('Die Rolle, die den Bot nutzen darf (z.B. @Co-Leader)')
      .setRequired(true)
  );

export async function execute(interaction) {
  // Sicherheitsprüfung: Nur Server-Owner oder Mitglieder mit Discord-Administrator-Rechten
  const isOwner = interaction.guild.ownerId === interaction.user.id;
  const isAdmin = Boolean(interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator));

  if (!isOwner && !isAdmin) {
    return await interaction.reply({
      content: '❌ **Keine Berechtigung!** Nur der Server-Owner oder Administratoren können berechtigte Rollen festlegen.',
      ephemeral: true
    });
  }

  const role = interaction.options.getRole('rolle');

  saveGuildSettings(interaction.guildId, { allowed_role_id: role.id });

  await interaction.reply({
    content:
      `✅ **Rolle erfolgreich freigeschaltet!**\n\n` +
      `Ab sofort können alle Mitglieder mit der Rolle <@&${role.id}> alle Befehle des Bots nutzen – ` +
      `**auch ohne eigene Discord-Administrator-Rechte**.\n\n` +
      `*(Tipp: Mitglieder mit dieser Rolle sollten in Discord einmal \`STRG + R\` drücken, falls Befehle noch nicht sofort im Menü auftauchen).*`
  });
}
