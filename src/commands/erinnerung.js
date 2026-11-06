import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings } from '../services/database.js';
import { getWarParticipation } from '../services/clashRoyale.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('erinnerung')
  .setDescription('Generiert die reine Text-Erinnerungsnachricht zum direkten Kopieren und Weiterleiten.');

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
    const playerLines = warData.incomplete.map((player) => {
      const decksWord = player.missedDecks === 1 ? 'Deck' : 'Decks';
      return `@${player.name}\t\t(${player.missedDecks} ${decksWord})`;
    });

    const fullMessage = `${prefix}\n\n${playerLines.join('\n')}`;

    // Discord Limit: 2000 Zeichen pro Nachricht
    if (fullMessage.length <= 2000) {
      await interaction.editReply({ content: fullMessage });
    } else {
      const chunks = [];
      let currentChunk = `${prefix}\n\n`;

      for (const line of playerLines) {
        if ((currentChunk + line).length > 1950) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        currentChunk += `${line}\n`;
      }
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

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
