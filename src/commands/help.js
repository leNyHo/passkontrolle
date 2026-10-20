import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { COLORS } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Zeigt eine Übersicht aller Befehle und Funktionen des Bots an.');

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO_BLUE)
    .setTitle('📖 Clash Royale Clan-Manager • Befehlsübersicht')
    .setDescription('Hier findest du alle verfügbaren Slash-Commands für das Clankriegs-Management:')
    .addFields(
      {
        name: '⚔️ Clankrieg & Status',
        value:
          '• `/erinnerung` – Zeigt den Status & eine 1-Klick-Kopiernachricht mit allen offenen Spielern (`@Name (X Decks)`).\n' +
          '• `/angriffe` – Live-Abfrage des Clankriegs-Status (wie `/erinnerung`).\n' +
          '• `/verwarnungen` – Übersicht aller verpassten Decks, Kick-Kandidaten & Copy-Paste Clan-Nachricht.\n' +
          '• `/testreport` – Erstellt einen realistischen Test-Abschlussbericht (ohne Verwarnungen zu speichern).\n' +
          '• `/resetstrikes [tag]` – Setzt die verpassten Decks eines einzelnen Spielers auf 0 zurück.\n' +
          '• `/resetallstrikes` – Löscht die Verwarnungen **aller** Spieler in der Datenbank (mit Sicherheitsabfrage).',
        inline: false
      },
      {
        name: '⚙️ Konfiguration & Verwaltung',
        value:
          '• `/erlauberolle [rolle]` – Erlaubt einer Rolle (z. B. Co-Leader) die Bot-Nutzung ohne Admin-Rechte.\n' +
          '• `/setreminder [rolle]` – Legt die Rolle fest, die montags an die Clankriegs-Zeitüberprüfung erinnert wird.\n' +
          '• `/setclan [tag]` – Legt den zu überwachenden Clan-Tag fest (z. B. `#2PP`).\n' +
          '• `/setchannel` – Legt den aktuellen Kanal als Ziel für den täglichen Abschlussbericht fest.\n' +
          '• `/settime [HH:MM]` – Passt die Kriegsende-Uhrzeit an (Europe/Berlin, Standard: `12:00`).\n' +
          '• `/seterinnerung [text]` – Ändert den Einleitungstext für die `/erinnerung` Nachricht.\n' +
          '• `/help` – Öffnet diese Hilfeübersicht.',
        inline: false
      },
      {
        name: '⏰ Automatischer Tagesbericht & Montags-Erinnerung',
        value:
          '• **Täglicher Abschlussbericht:** Pünktlich zum Kriegsende postet der Bot automatisch den Bericht inklusive unvollständiger Spieler und **Kick-Vorschlägen (ab 5+ Decks)**.\n' +
          '• **Montags-Zeitüberprüfung:** Jeden Montag nach dem Kriegsbericht wird die per `/setreminder` hinterlegte Rolle gepingt, um die Startzeit der Folgewoche zu prüfen (Bestätigung via ✅, Wiederholung alle 24h).',
        inline: false
      }
    )
    .setFooter({ text: 'Clash Royale Admin Bot • Reines Admin-Tool' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
