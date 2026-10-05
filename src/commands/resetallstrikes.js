import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { resetAllStrikes } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('resetallstrikes')
  .setDescription('Löscht ALLE Verwarnungen und verpassten Decks in der Datenbank (mit Sicherheitsabfrage).');

export async function execute(interaction) {
  const confirmBtn = new ButtonBuilder()
    .setCustomId('confirm_reset_all')
    .setLabel('Ja, alle Verwarnungen löschen')
    .setStyle(ButtonStyle.Danger);

  const cancelBtn = new ButtonBuilder()
    .setCustomId('cancel_reset_all')
    .setLabel('Abbrechen')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

  const response = await interaction.reply({
    content:
      '⚠️ **SICHERHEITSABFRAGE: Bist du sicher, dass du ALLE Verwarnungen löschen möchtest?**\n' +
      'Dadurch werden die verpassten Decks ALLER Spieler in der SQLite-Datenbank auf **0** zurückgesetzt.\n' +
      'Dieser Vorgang kann **nicht rückgängig** gemacht werden!',
    components: [row]
  });

  const collectorFilter = (i) => i.user.id === interaction.user.id;

  try {
    const confirmation = await response.awaitMessageComponent({
      filter: collectorFilter,
      time: 60_000
    });

    if (confirmation.customId === 'confirm_reset_all') {
      const changed = resetAllStrikes();
      await confirmation.update({
        content: `✅ **Erfolgreich!** Alle Verwarnungen und verpassten Decks in der Datenbank wurden zurückgesetzt (${changed} Spieler bereinigt).`,
        components: []
      });
    } else if (confirmation.customId === 'cancel_reset_all') {
      await confirmation.update({
        content: '❌ **Vorgang abgebrochen.** Es wurden keine Daten gelöscht.',
        components: []
      });
    }
  } catch {
    await interaction.editReply({
      content: '⏱️ **Zeitüberschreitung:** Es wurde keine Auswahl getroffen. Der Vorgang wurde abgebrochen.',
      components: []
    });
  }
}
