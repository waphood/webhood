// ── AUTH MODULE ──────────────────────────────────────────────────────────────
// Регистрация и вход через Firebase Authentication (email + пароль).
// Пароли хранит Firebase — мы их вообще не видим и не храним.
// После регистрации приходит письмо с подтверждением на почту.

import {
  firebaseRegister, firebaseLogin, firebaseLogout,
  onAuthChanged, getUsers, saveUser, scheduleUsersFlush
} from "./firebase.js";

export let currentUser = null;

export function getSessionUsername()  { return localStorage.getItem("hood_username"); }
export function setSessionUsername(u) { localStorage.setItem("hood_username", u); }
export function clearSessionUsername(){ localStorage.removeItem("hood_username"); }

// ── Регистрация ──────────────────────────────────────────────────────────────
export async function register({ username, displayName, email, password }) {
  if (!/^[a-z0-9_]{2,24}$/.test(username))
    throw new Error("Ник: 2-24 символа, только a-z, 0-9, _");
  if (!displayName.trim())
    throw new Error("Напиши своё имя");
  if (!email.includes("@"))
    throw new Error("Введи корректный email");
  if (password.length < 6)
    throw new Error("Пароль слишком короткий (мин. 6 символов)");

  const users = getUsers();
  if (users[username]) throw new Error("Этот ник уже занят");

  const firebaseUser = await firebaseRegister(email, password);

  const newUser = {
    username, displayName: displayName.trim(), email,
    firebaseUid: firebaseUser.uid,
    bio: "", avatar: "", background: "default", accentColor: "#c8ff00",
    links: [], music: "", musicName: "",
    likes: 0, dislikes: 0, comments: [],
    createdAt: Date.now(), lastSeen: Date.now()
  };

  await saveUser(newUser);
  // НЕ логиним сразу — ждём подтверждения почты
  return newUser;
}

// ── Вход ──────────────────────────────────────────────────────────────────────
export async function login({ email, password }) {
  const firebaseUser = await firebaseLogin(email, password);

  const users = getUsers();
  const profile = Object.values(users).find(u => u.firebaseUid === firebaseUser.uid);

  if (!profile) {
    await firebaseLogout();
    throw new Error("Профиль не найден. Попробуй зарегистрироваться заново.");
  }
  if (profile.banned) {
    await firebaseLogout();
    throw new Error("Этот профиль заблокирован.");
  }

  profile.lastSeen = Date.now();
  await saveUser(profile);
  currentUser = profile;
  setSessionUsername(profile.username);
  return profile;
}

// ── Выход ─────────────────────────────────────────────────────────────────────
export async function logout() {
  await firebaseLogout();
  currentUser = null;
  clearSessionUsername();
}

// ── Восстановление сессии ─────────────────────────────────────────────────────
export async function restoreSession() {
  return new Promise(resolve => {
    onAuthChanged(async firebaseUser => {
      if (!firebaseUser || !firebaseUser.emailVerified) {
        currentUser = null;
        clearSessionUsername();
        resolve(null);
        return;
      }
      const users = getUsers();
      const profile = Object.values(users).find(u => u.firebaseUid === firebaseUser.uid);
      if (!profile || profile.banned) {
        await firebaseLogout();
        currentUser = null;
        clearSessionUsername();
        resolve(null);
        return;
      }
      profile.lastSeen = Date.now();
      await saveUser(profile);
      currentUser = profile;
      setSessionUsername(profile.username);
      resolve(profile);
    });
  });
}

export async function saveCurrentUser() {
  if (!currentUser) return;
  await saveUser(currentUser);
}

export function scheduleCurrentUserFlush() {
  if (!currentUser) return;
  const users = getUsers();
  users[currentUser.username] = currentUser;
  scheduleUsersFlush(users);
}
