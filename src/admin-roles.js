/**
 * Admin roles: { general: bool, f1: bool, futbol: bool, mundial: bool }
 * - general: gestión de usuarios
 * - f1: administración de la porra de F1
 * - futbol: administración de la porra de fútbol
 * - mundial: administración de la porra del Mundial 2026
 *
 * Backward compat: isAdmin:true sin adminRoles = admin total
 */

export function isAdminFor(user, role) {
  if (!user) return false;
  if (user.isAdmin && !user.adminRoles) return true;
  return !!user.adminRoles?.[role];
}

export function hasAnyAdminRole(user) {
  if (!user) return false;
  if (user.isAdmin && !user.adminRoles) return true;
  const r = user.adminRoles;
  return !!(r?.general || r?.f1 || r?.futbol || r?.mundial);
}

export function getAdminRoles(user) {
  if (!user) return { general: false, f1: false, futbol: false, mundial: false };
  if (user.isAdmin && !user.adminRoles) return { general: true, f1: true, futbol: true, mundial: true };
  return {
    general: !!user.adminRoles?.general,
    f1: !!user.adminRoles?.f1,
    futbol: !!user.adminRoles?.futbol,
    mundial: !!user.adminRoles?.mundial,
  };
}

export const ADMIN_ROLE_LABELS = {
  general: "General",
  f1: "F1",
  futbol: "Fútbol",
  mundial: "Mundial",
};
