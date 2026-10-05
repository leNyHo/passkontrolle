import { SlashCommandBuilder } from 'discord.js';
import { execute as wasistdasproblemExecute } from './wasistdasproblem.js';

export const data = new SlashCommandBuilder()
  .setName('warumgehtsnicht')
  .setDescription('Diagnose-Tool (Alias für /wasistdasproblem)')
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('Optional: Bestimmten Nutzer prüfen, der den Bot nicht nutzen kann')
      .setRequired(false)
  );

export async function execute(interaction) {
  await wasistdasproblemExecute(interaction);
}
