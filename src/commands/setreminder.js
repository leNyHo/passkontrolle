import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings, saveGuildSettings } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('setreminder')
  .setDescription('Legt die Rolle fest, die montags nach dem Clankrieg an die Zeitüberprüfung erinnert wird.')
  .addRoleOption((option) =>
    option
      .setName('rolle')
      .setDescription('Die Rolle, die angepingt werden soll (z.B. @Leader oder @Co-Leader)')
      .setRequired(false)
  )
  .addBooleanOption((option) =>
    option
      .setName('deaktivieren')
      .setDescription('Deaktiviert die automatische Montags-Erinnerung für diesen Server')
      .setRequired(false)
  );

export async function execute(interaction) {
  const role = interaction.options.getRole('rolle');
  const disable = interaction.options.getBoolean('deaktivieren');

  if (disable) {
    saveGuildSettings(interaction.guildId, { reminder_role_id: null });
    return await interaction.reply({
      content: '✅ **Montags-Erinnerung deaktiviert!** Es werden nach dem Clankrieg keine Erinnerungen zur Zeitüberprüfung mehr gesendet.'
    });
  }

  if (role) {
    saveGuildSettings(interaction.guildId, { reminder_role_id: role.id });
    return await interaction.reply({
      content:
        `✅ **Erinnerungs-Rolle erfolgreich festgelegt!**\n\n` +
        `Jeden Montag nach dem Clankriegs-Abschlussbericht wird ab sofort die Rolle <@&${role.id}> gepingt, ` +
        `um die Clankriegs-Endzeit für die kommende Woche zu prüfen.\n\n` +
        `• Reagiert ein Mitglied mit **✅**, gilt die Zeit als bestätigt.\n` +
        `• Erfolgt innerhalb von 24 Stunden keine Reaktion, erinnert der Bot automatisch erneut.`
    });
  }

  // Weder Rolle noch deaktivieren gewählt -> Aktuellen Status anzeigen
  const settings = getGuildSettings(interaction.guildId);
  if (settings.reminder_role_id) {
    return await interaction.reply({
      content:
        `ℹ️ **Aktuelle Erinnerungs-Einstellung:**\n\n` +
        `Aktuell ist die Rolle <@&${settings.reminder_role_id}> für die Montags-Zeitüberprüfung hinterlegt.\n\n` +
        `• Zum Ändern: \`/setreminder [rolle]\`\n` +
        `• Zum Deaktivieren: \`/setreminder deaktivieren:True\``,
      ephemeral: true
    });
  }

  return await interaction.reply({
    content:
      `ℹ️ Für diesen Server ist aktuell **keine Rolle** für die Montags-Erinnerung festgelegt.\n\n` +
      `Nutze \`/setreminder [rolle]\`, um eine Rolle (z.B. @Co-Leader) zu hinterlegen.`,
    ephemeral: true
  });
}
