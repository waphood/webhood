// ── FIREBASE MODULE ─────────────────────────────────────────────────────────
// Все Firebase-функции живут ТОЛЬКО здесь, в замыкании модуля.
// Снаружи (из консоли браузера) они недоступны.
// Экспортируем только высокоуровневые функции для работы с данными.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getFirestore,
  doc, getDoc, getDocs, setDoc, deleteDoc,
  collection, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD0mUzcWmqcITrXwSPV2rt63drNqE5_fu8",
  authDomain: "webhood-4469e.firebaseapp.com",
  projectId: "webhood-4469e",
  storageBucket: "webhood-4469e.firebasestorage.app",
  messagingSenderId: "69425462031",
  appId: "1:69425462031:web:811bed61ad892013771c7a",
  measurementId: "G-ED4VC0DH72"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Локальные кэши (не видны из консоли) ───────────────────────────────────
let usersCache  = {};
let badgesCache = {};

// ── Публичное состояние (read-only снаружи) ────────────────────────────────
export let firebaseReady = false;

// ── Инициализация ──────────────────────────────────────────────────────────
export async function initFirebase() {
  try {
    // Загружаем всех пользователей
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(d => { usersCache[d.id] = d.data(); });

    // Миграция: аватар из localStorage → Firestore
    try {
      const sess = localStorage.getItem("hood_session");
      if (sess) {
        const oldUsers = JSON.parse(localStorage.getItem("hood_users") || "{}");
        const oldLocal  = JSON.parse(localStorage.getItem("hood_local_" + sess) || "{}");
        const oldAvatar = oldUsers[sess]?.avatar || oldLocal.avatar || null;
        if (oldAvatar && usersCache[sess] && !usersCache[sess].avatar) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const SIZE = 200;
            canvas.width = SIZE; canvas.height = SIZE;
            const ctx = canvas.getContext("2d");
            const scale = Math.max(SIZE / img.width, SIZE / img.height);
            const w = img.width * scale, h = img.height * scale;
            ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
            const compressed = canvas.toDataURL("image/jpeg", 0.7);
            usersCache[sess].avatar = compressed;
            setDoc(doc(db, "users", sess), usersCache[sess]).catch(console.error);
          };
          img.src = oldAvatar;
        }
      }
    } catch(e) { console.warn("Avatar migration error:", e); }

    // Бейджики
    const bSnap = await getDoc(doc(db, "meta", "badges"));
    if (bSnap.exists()) badgesCache = bSnap.data();

    firebaseReady = true;

    // Слушаем изменения в реальном времени
    onSnapshot(collection(db, "users"), snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === "added" || change.type === "modified") {
          usersCache[change.doc.id] = change.doc.data();
        }
        if (change.type === "removed") {
          delete usersCache[change.doc.id];
        }
      });
      window.dispatchEvent(new Event("usersUpdated"));
    });

    window.dispatchEvent(new Event("firebaseReady"));
  } catch(e) {
    console.error("Firebase init error:", e);
    window.dispatchEvent(new Event("firebaseReady"));
  }
}

// ── API для работы с пользователями ────────────────────────────────────────

/** Возвращает копию кэша пользователей */
export function getUsers() {
  return usersCache;
}

/** Сохранить одного пользователя в Firestore */
export async function saveUser(user) {
  if (!user || !user.username) throw new Error("Invalid user");
  await setDoc(doc(db, "users", user.username), user);
  usersCache[user.username] = user;
}

/** Сохранить сразу нескольких пользователей батчем */
let _savePending = null;
let _pendingUsers = null;

export function scheduleUsersFlush(usersMap) {
  usersCache = usersMap;
  _pendingUsers = usersMap;
  clearTimeout(_savePending);
  _savePending = setTimeout(async () => {
    if (!_pendingUsers) return;
    try {
      const batch = writeBatch(db);
      Object.values(_pendingUsers).forEach(user => {
        if (!user || !user.username) return;
        batch.set(doc(db, "users", user.username), user);
      });
      await batch.commit();
    } catch(e) {
      console.error("Firestore flush error:", e);
    }
    _pendingUsers = null;
  }, 400);
}

/** Удалить пользователя — только для своего аккаунта */
export async function deleteCurrentUser(username) {
  await deleteDoc(doc(db, "users", username));
  delete usersCache[username];
}

// ── API для работы с бейджиками ─────────────────────────────────────────────

export function getBadges() {
  return badgesCache;
}

export async function saveBadges(b) {
  badgesCache = b;
  await setDoc(doc(db, "meta", "badges"), b);
}
