/** Profile + world persistence: localStorage for profiles, JSON download/upload for worlds. */

export interface UserProfile {
  username: string;
  guest: boolean;
  skin: 'steve';
  createdAt: number;
}

const PROFILES_KEY = 'mcweb:profiles'; // registered accounts: username -> {salt, hash}
const SESSION_KEY = 'mcweb:session'; // current logged in username or 'guest'
const SKIN_KEY = 'mcweb:skins';

interface StoredCredential {
  salt: string;
  hash: string;
}

/** NOTE: demo-grade credential storage for a browser game (not a real auth system). */
async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readJSON<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, T>;
  } catch {
    return {};
  }
}

export function listProfiles(): string[] {
  return Object.keys(readJSON<StoredCredential>(PROFILES_KEY));
}

export async function signUp(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const name = username.trim();
  if (name.length < 3) return { ok: false, error: 'Username must be at least 3 characters' };
  if (password.length < 4) return { ok: false, error: 'Password must be at least 4 characters' };
  const profiles = readJSON<StoredCredential>(PROFILES_KEY);
  if (profiles[name]) return { ok: false, error: 'That username is already taken' };
  const salt = crypto.randomUUID();
  profiles[name] = { salt, hash: await hashPassword(password, salt) };
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  return { ok: true };
}

export async function logIn(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const profiles = readJSON<StoredCredential>(PROFILES_KEY);
  const cred = profiles[username.trim()];
  if (!cred) return { ok: false, error: 'No account with that username' };
  const hash = await hashPassword(password, cred.salt);
  if (hash !== cred.hash) return { ok: false, error: 'Wrong password' };
  return { ok: true };
}

export function startSession(profile: UserProfile): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
}

export function getSession(): UserProfile | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function endSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/** Skin selection persisted per profile. */
export function setSkin(username: string, skin: UserProfile['skin']): void {
  const skins = readJSON<UserProfile['skin']>(SKIN_KEY);
  skins[username] = skin;
  localStorage.setItem(SKIN_KEY, JSON.stringify(skins));
}

export function getSkin(username: string): UserProfile['skin'] {
  return readJSON<UserProfile['skin']>(SKIN_KEY)[username] ?? 'steve';
}

/** Triggers a browser download of a JSON world file. */
export function downloadWorldFile(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Reads a user-picked JSON file, resolves with its text. */
export function pickWorldFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
