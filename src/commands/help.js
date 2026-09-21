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
          '• `/erinnerung` – Erstellt einen fertigen Text mit säumigen Spielern zum Kopieren/Erinnern.\n' +
          '• `/verwarnungen` – Zeigt die SQLite-Historie aller verpassten Decks & Kick-Kandidaten (ab 5+ Decks).\n' +
          '• `/resetstrikes [tag]` – Setzt die verpassten Decks eines Spielers in der Datenbank auf 0 zurück.',
        inline: false
      },
      {
        name: '⚙️ Konfiguration & Einstellungen',
        value:
          '• `/setclan [tag]` – Legt den zu überwachenden Clan-Tag fest (z. B. `#2PP`).\n' +
          '• `/setchannel` – Legt den aktuellen Kanal als Ziel für den täglichen Abschlussbericht fest.\n' +
          '• `/settime [HH:MM]` – Passt die Kriegsende-Uhrzeit an (Europe/Berlin, Standard: `12:00`).\n' +
          '• `/setwarning [text]` – Ändert die Verwarnnachricht im täglichen Abschlussbericht.\n' +
          '• `/seterinnerung [text]` – Ändert den Einleitungstext für den `/erinnerung` Befehl.\n' +
          '• `/help` – Öffnet diese Hilfeübersicht.',
        inline: false
      },
      {
        name: '⏰ Automatischer Tagesbericht',
        value:
          'Pünktlich zum eingestellten Kriegsende postet der Bot automatisch ein Embed mit:\n' +
          '1. Allen Spielern, die heute nicht alle 4 Angriffe gemacht haben.\n' +
          '2. Konkreten **Kick-Vorschlägen** für Spieler mit **5+ angesammelten Fehldecks**.\n' +
          '3. Der hinterlegten Verwarnnachricht.',
        inline: false
      }
    )
    .setFooter({ text: 'Clash Royale Admin Bot • Reines Admin-Tool' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
