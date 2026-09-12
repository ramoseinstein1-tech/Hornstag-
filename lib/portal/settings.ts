/**
 * MOCK, CLIENT-SIDE PORTAL SETTINGS STORE
 * ─────────────────────────────────────────────────────────────────
 * Same pattern as the other lib/portal and lib/auth stores. Team
 * "invites" here just add a row to this list — no invite email is
 * ever sent, since there's no email service or backend. Replace with
 * real invite emails + a real members table before this manages
 * actual account access.
 */

export type TeamRole = "Owner" | "Member";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
};

export type NotificationPrefs = {
  projectComplete: boolean;
  billingReceipts: boolean;
  productUpdates: boolean;
};

export type PortalSettings = {
  teamMembers: TeamMember[];
  notifications: NotificationPrefs;
};

const KEY_PREFIX = "hornstag_settings_";

function isBrowser() {
  return typeof window !== "undefined";
}

function key(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function seedSettings(owner: { name: string; email: string }): PortalSettings {
  return {
    teamMembers: [{ id: "owner", name: owner.name, email: owner.email, role: "Owner" }],
    notifications: {
      projectComplete: true,
      billingReceipts: true,
      productUpdates: false,
    },
  };
}

function isValidShape(data: unknown): data is PortalSettings {
  if (!data || typeof data !== "object") return false;
  const d = data as PortalSettings;
  return Array.isArray(d.teamMembers) && typeof d.notifications === "object";
}

function readSettings(userId: string, owner: { name: string; email: string }): PortalSettings {
  if (!isBrowser()) return seedSettings(owner);
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidShape(parsed)) return parsed;
    }
  } catch {
    // Corrupt data — fall through and reseed.
  }
  const seeded = seedSettings(owner);
  writeSettings(userId, seeded);
  return seeded;
}

function writeSettings(userId: string, data: PortalSettings) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key(userId), JSON.stringify(data));
}

export function getSettings(userId: string, owner: { name: string; email: string }): PortalSettings {
  return readSettings(userId, owner);
}

export function addTeamMember(
  userId: string,
  owner: { name: string; email: string },
  input: { name: string; email: string }
): PortalSettings {
  const data = readSettings(userId, owner);
  data.teamMembers = [
    ...data.teamMembers,
    { id: crypto.randomUUID(), name: input.name.trim(), email: input.email.trim().toLowerCase(), role: "Member" },
  ];
  writeSettings(userId, data);
  return data;
}

export function removeTeamMember(
  userId: string,
  owner: { name: string; email: string },
  memberId: string
): PortalSettings {
  const data = readSettings(userId, owner);
  data.teamMembers = data.teamMembers.filter((m) => m.id !== memberId);
  writeSettings(userId, data);
  return data;
}

export function updateNotifications(
  userId: string,
  owner: { name: string; email: string },
  prefs: Partial<NotificationPrefs>
): PortalSettings {
  const data = readSettings(userId, owner);
  data.notifications = { ...data.notifications, ...prefs };
  writeSettings(userId, data);
  return data;
}

export function deleteUserData(userId: string) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key(userId));
}
