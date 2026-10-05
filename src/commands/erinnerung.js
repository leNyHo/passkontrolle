import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings } from '../services/database.js';
import { getWarParticipation } from '../services/clashRoyale.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('erinnerung')
  .setDescription('Generiert eine Erinnerungsnachricht mit allen Spielern, die noch Decks offen haben.');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const settings = getGuildSettings(interaction.guildId);
    if (!settings.clan_tag) {
      return await interaction.editReply({
        content: '❌ **Kein Clan-Tag hinterlegt!** Bitte nutze zuerst `/setclan [Clan-Tag]`.'
      });
    }

    const warData = await getWarParticipation(settings.clan_tag);

    if (warData.incomplete.length === 0) {
      return await interaction.editReply({
        content: '🎉 **Alle Spieler haben ihre Angriffe für heute bereits erledigt!**'
      });
    }

    const prefix = settings.reminder_message || config.defaultReminderMessage;
    const playerEntries = warData.incomplete.map(p => `@${p.name} (${p.missedDecks})`);
    const reminderText = `${prefix} ${playerEntries.join(', ')}`;

    // Discord Limit: 2000 Zeichen
    if (reminderText.length <= 2000) {
      await interaction.editReply({ content: reminderText });
    } else {
      // Falls es das Zeichenlimit überschreitet, in lesbare Abschnitte aufteilen
      const chunks = [];
      let current = `${prefix}\n`;
      for (const entry of playerEntries) {
        if (current.length + entry.length + 2 > 1950) {
          chunks.push(current);
          current = '';
        }
        current += (current ? ', ' : '') + entry;
      }
      if (current) chunks.push(current);

      await interaction.editReply({ content: chunks[0] });
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({ content: chunks[i] });
      }
    }
  } catch (error) {
    console.error('Fehler bei /erinnerung:', error);
    await interaction.editReply({
      content: `❌ **Fehler beim Abrufen der Clankriegsdaten:**\n${error.message}`
    });
  }
}
