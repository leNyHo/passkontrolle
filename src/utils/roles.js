import { PermissionFlagsBits } from 'discord.js';

export const ROLE_NAME = 'Passkontroll-User';

/**
 * Stellt sicher, dass die Rolle "Passkontroll-User" auf dem Server existiert.
 * Falls sie noch nicht existiert und der Bot Rollen verwalten darf, wird sie automatisch erstellt.
 */
export async function ensurePasskontrollRole(guild) {
  if (!guild) return null;

  try {
    // 1. Im Cache suchen
    let role = guild.roles.cache.find(
      (r) => r.name.toLowerCase() === ROLE_NAME.toLowerCase()
    );
    if (role) return role;

    // 2. Rollen fetchen falls Cache unvollständig
    const fetchedRoles = await guild.roles.fetch().catch(() => null);
    if (fetchedRoles) {
      role = fetchedRoles.find(
        (r) => r.name.toLowerCase() === ROLE_NAME.toLowerCase()
      );
      if (role) return role;
    }

    // 3. Bot-Rechte prüfen
    const botMember =
      guild.members.me || (await guild.members.fetchMe().catch(() => null));
    if (!botMember) return null;

    const hasManageRoles = Boolean(
      botMember.permissions?.has?.(PermissionFlagsBits.ManageRoles)
    );
    const hasAdmin = Boolean(
      botMember.permissions?.has?.(PermissionFlagsBits.Administrator)
    );

    if (hasManageRoles || hasAdmin) {
      role = await guild.roles.create({
        name: ROLE_NAME,
        color: 0x5865f2, // Discord Blurple
        reason: 'Automatisch erstellte Zugriffsrolle für den Clash Royale Bot'
      });
      console.log(
        `[Rollen] Rolle '${ROLE_NAME}' auf Server "${guild.name}" (${guild.id}) erfolgreich erstellt!`
      );
      return role;
    }
  } catch (error) {
    console.warn(
      `[Rollen] Konnte Rolle '${ROLE_NAME}' auf Server "${guild.name}" nicht erstellen:`,
      error.message
    );
  }

  return null;
}

/**
 * Prüft, ob ein Mitglied die Rolle "Passkontroll-User" besitzt.
 */
export function hasPasskontrollRole(member, guild) {
  if (!member) return false;

  // Cache-Prüfung
  if (member.roles?.cache?.some) {
    return member.roles.cache.some(
      (r) => r.name.toLowerCase() === ROLE_NAME.toLowerCase()
    );
  }

  // Array von Role-IDs Prüfung
  if (Array.isArray(member.roles) && guild?.roles?.cache) {
    return member.roles.some((roleId) => {
      const r = guild.roles.cache.get(roleId);
      return r && r.name.toLowerCase() === ROLE_NAME.toLowerCase();
    });
  }

  return false;
}
