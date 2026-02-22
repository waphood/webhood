// ── AUTH MODULE ──────────────────────────────────────────────────────────────
// Регистрация, вход, сессии.
// Пароли хранятся как SHA-256(salt + password + salt) — не plain-text.

import { getUsers, saveUser, scheduleUsersFlush } from "./firebase.js";

// Соль для хэша. Меняй на свою уникальную строку, она не секретная —
// просто делает rainbow-table атаки бесполезными.
const SALT = "wh_4469e_s4lt_v2";

export let currentUser = null;

// ── Хэш пароля ──────────────────────────────────────────────────────────────
export async function hashPassword(password) {
  if (window.crypto?.subtle) {
    try {
      const data = new TextEncoder().encode(SALT + password + SALT);
      const buf  = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
    } catch(e) {}
  }
  // Fallback для HTTP / старых браузеров
  let h = 5381;
  const s = SALT + password + SALT;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return "fb_" + (h >>> 0).toString(16).padStart(8, "0") + s.length.toString(16);
}

// ── Сессия ──────────────────────────────────────────────────────────────────
export function getSession()   { return localStorage.getItem("hood_session"); }
export function setSession(u)  { localStorage.setItem("hood_session", u); }
export function clearSession() { localStorage.removeItem("hood_session"); }

// ── Регистрация ─────────────────────────────────────────────────────────────
export async function register({ username, displayName, password }) {
  // Валидация
  if (!/^[a-z0-9_]{2,24}$/.test(username)) {
    throw new Error("Имя: 2-24 символа, только a-z, 0-9, _");
  }
  if (!displayName.trim()) {
    throw new Error("Напиши своё имя");
  }
  if (password.length < 6) {
    throw new Error("Пароль слишком короткий (мин. 6 символов)");
  }

  const users = getUsers();
  if (users[username]) {
    throw new Error("Этот username занят");
  }

  const newUser = {
    username,
    displayName: displayName.trim(),
    password: await hashPassword(password),
    bio: "",
    avatar: "",
    background: "default",
    accentColor: "#c8ff00",
    links: [],
    music: "",
    musicName: "",
    likes: 0,
    dislikes: 0,
    comments: [],
    createdAt: Date.now(),
    lastSeen: Date.now()
  };

  await saveUser(newUser);
  currentUser = newUser;
  setSession(username);
  return newUser;
}

// ── Вход ─────────────────────────────────────────────────────────────────────
export async function login({ username, password }) {
  const users = getUsers();
  const u = users[username];

  if (!u) {
    throw new Error("Неверный username или пароль");
  }

  // Поддержка старых хэшей (без соли) и новых (с солью)
  const newHash = await hashPassword(password);

  // Старый хэш (sha256 без соли) — для плавной миграции
  let oldHash = "";
  if (window.crypto?.subtle) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
      oldHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
    } catch(e) {}
  }

  if (u.password !== newHash && u.password !== oldHash) {
    throw new Error("Неверный username или пароль");
  }

  // Если пароль хранился без соли — апгрейдим
  if (u.password === oldHash && oldHash !== newHash) {
    u.password = newHash;
    await saveUser(u);
  }

  if (u.banned) {
    throw new Error("Этот профиль заблокирован");
  }

  u.lastSeen = Date.now();
  await saveUser(u);

  currentUser = u;
  setSession(username);
  return u;
}

// ── Выход ────────────────────────────────────────────────────────────────────
export function logout() {
  currentUser = null;
  clearSession();
}

// ── Восстановление сессии ────────────────────────────────────────────────────
export async function restoreSession() {
  const sess = getSession();
  if (!sess) return null;

  const users = getUsers();
  const u = users[sess];
  if (!u) { clearSession(); return null; }
  if (u.banned) { clearSession(); return null; }

  u.lastSeen = Date.now();
  await saveUser(u);
  currentUser = u;
  return u;
}

// ── Обновить текущего пользователя ───────────────────────────────────────────
export async function saveCurrentUser() {
  if (!currentUser) return;
  const users = getUsers();
  users[currentUser.username] = currentUser;
  await saveUser(currentUser);
}

export function scheduleCurrentUserFlush() {
  if (!currentUser) return;
  const users = getUsers();
  users[currentUser.username] = currentUser;
  scheduleUsersFlush(users);
}
