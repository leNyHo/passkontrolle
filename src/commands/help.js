import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { COLORS } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Zeigt eine Übersicht aller Befehle und Funktionen des Bots an.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO_BLUE)
    .setTitle('📖 Clash Royale Clan-Manager • Befehlsübersicht')
    .setDescription('Hier findest du alle verfügbaren Admin Slash-Commands für das Clankriegs-Management:')
    .addFields(
      {
        name: '⚔️ Clankrieg & Status',
        value:
          '• `/angriffe` – Ruft den aktuellen Angriffsstatus live ab (wer hat heute noch Decks offen?).\n' +
          '• `/erinnerung` – Erstellt einen fertigen Erinnerungstext mit `@Name (offene Decks)` zum Kopieren/Pingen.\n' +
          '• `/verwarnungen` – Zeigt die SQLite-Historie aller verpassten Decks & Kick-Kandidaten (ab 5+ Decks).\n' +
          '• `/resetstrikes [tag]` – Setzt die verpassten Decks eines einzelnen Spielers auf 0 zurück.\n' +
          '• `/resetallstrikes` – Löscht die Verwarnungen **aller** Spieler in der Datenbank (mit Sicherheitsabfrage).',
        inline: false
      },
      {
        name: '⚙️ Konfiguration & Einstellungen',
        value:
          '• `/setclan [tag]` – Legt den zu überwachenden Clan-Tag fest (z. B. `#2PP`).\n' +
          '• `/setchannel` – Legt den aktuellen Kanal als Ziel für Berichte und Erinnerungen fest.\n' +
          '• `/settime [HH:MM]` – Passt die Kriegsende-Uhrzeit an (Europe/Berlin, Standard: `12:00`).\n' +
          '• `/seterinnerung [text]` – Ändert den Einleitungstext für die `/erinnerung` Nachricht.\n' +
          '• `/help` – Öffnet diese Hilfeübersicht.',
        inline: false
      },
      {
        name: '⏰ Automatische Benachrichtigungen',
        value:
          '1. **1 Minute vor Kriegsende:** Der Bot postet automatisch die `/erinnerung` Nachricht in den Admin-Kanal (sofern noch Decks offen sind).\n' +
          '2. **Pünktlich zum Kriegsende:** Der Bot postet den offiziellen Abschlussbericht mit unvollständigen Spielern und konkreten **Kick-Vorschlägen (ab 5+ Decks)**.',
        inline: false
      }
    )
    .setFooter({ text: 'Clash Royale Admin Bot • Reines Admin-Tool' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
