import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
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
          '• `/angriffe` – Ruft den aktuellen Angriffsstatus live ab (wer hat heute noch Decks offen?).\n' +
          '• `/erinnerung` – Erstellt einen fertigen Erinnerungstext mit `@Name (offene Decks)` zum Kopieren/Pingen.\n' +
          '• `/verwarnungen` – Zeigt die SQLite-Historie aller verpassten Decks & Kick-Kandidaten (ab 5+ Decks).\n' +
          '• `/resetstrikes [tag]` – Setzt die verpassten Decks eines einzelnen Spielers auf 0 zurück.\n' +
          '• `/resetallstrikes` – Löscht die Verwarnungen **aller** Spieler in der Datenbank (mit Sicherheitsabfrage).',
        inline: false
      },
      {
        name: '⚙️ Konfiguration & Diagnose',
        value:
          '• `/erlauberolle [rolle]` – Erlaubt einer Rolle (z. B. Co-Leader) die Bot-Nutzung ohne Admin-Rechte.\n' +
          '• `/setclan [tag]` – Legt den zu überwachenden Clan-Tag fest (z. B. `#2PP`).\n' +
          '• `/setchannel` – Legt den aktuellen Kanal als Ziel für den täglichen Abschlussbericht fest.\n' +
          '• `/settime [HH:MM]` – Passt die Kriegsende-Uhrzeit an (Europe/Berlin, Standard: `12:00`).\n' +
          '• `/seterinnerung [text]` – Ändert den Einleitungstext für die `/erinnerung` Nachricht.\n' +
          '• `/warumgehtsnicht [user]` – Diagnose-Tool: Prüft Berechtigungen, Kanalrechte und Rollen.\n' +
          '• `/help` – Öffnet diese Hilfeübersicht.',
        inline: false
      },
      {
        name: '⏰ Automatischer Tagesbericht',
        value:
          'Pünktlich zum eingestellten Kriegsende postet der Bot automatisch den offiziellen Abschlussbericht mit allen unvollständigen Spielern und konkreten **Kick-Vorschlägen (ab 5+ Decks)** in den festgelegten Kanal.',
        inline: false
      }
    )
    .setFooter({ text: 'Clash Royale Admin Bot • Reines Admin-Tool' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
