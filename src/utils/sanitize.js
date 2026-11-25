/**
 * Entfernt sensible Daten (IPv4/IPv6, Tokens, E-Mails, Dateipfade) aus Texten und Fehlermeldungen,
 * damit bei Ausgabe in öffentlichen Discord-Kanälen kein versehentliches Doxxing entsteht.
 */
export function sanitizePublicText(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    // Bearer- und JWT-Tokens
    .replace(/Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g, '[TOKEN-REDACTED]')
    // IPv4-Adressen (z. B. 34.133.77.68)
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP-REDACTED]')
    // IPv6-Adressen (mindestens :: oder >= 4 Doppelpunkt-Segmente, damit HH:MM:SS nicht getroffen wird)
    .replace(/(?:^|(?<=[\s([{"']))(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(?=$|[\s)\]}"',.])/g, (match) => {
      return match.includes('::') || match.split(':').length >= 4 ? '[IP-REDACTED]' : match;
    })
    // E-Mail-Adressen
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL-REDACTED]')
    // Interne Dateipfade (Windows / Linux)
    .replace(/(?:[A-Za-z]:\\|\/(?:app|home|var|etc|root|tmp|Users)\/)[^\s)"'`]+/g, '[PFAD-REDACTED]');
}
