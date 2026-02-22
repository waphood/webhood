// ── APP.JS — точка входа ─────────────────────────────────────────────────────
// Этот файл связывает все модули и выставляет функции в window
// только те, которые нужны для onclick-атрибутов в HTML.
// Firebase и методы записи в БД — НЕ выставляются.

import { initFirebase, getUsers } from "./firebase.js";
import {
  currentUser as _cu, register as _register, login as _login,
  logout as _logout, restoreSession, hashPassword, getSession
} from "./auth.js";
import { updateLandingStats } from "./landing.js";
import { renderExplore, openUserProfile as _openUserProfile } from "./explore.js";
import {
  showProfileView, initAudio, viewingProfile as _vp,
  react, postComment, renderComments, toggleReplyForm,
  togglePin, reactComment, toggleAsSelf,
  togglePlay, stopMusic, seekMusic, updateReactionDisplay
} from "./profile.js";
import {
  loadDashboard, handleAvatarUpload, handleBgUpload, selectBg,
  previewAccent, handleMusicUpload, removeMusic, saveMusicDisplayName,
  updateMusicUI, renderLinksList, addLink, removeLink, updateLink,
  saveProfile, initNickFontGrid, saveNickStyle, updateNickPreview,
  exportTheme, copyThemeJson, renderSavedThemes, applyTheme,
  downloadSavedTheme, deleteSavedTheme, handleThemeFile,
  handleThemeDrop, importThemeFromText
} from "./dashboard.js";
import {
  openAdmin, closeAdmin, switchAdminTab, renderAdminUsers,
  toggleAdminUser, adminSaveRating, adminResetRating,
  adminToggleVerified, adminToggleBan, adminDeleteComment,
  adminDeleteUser, handleBadgeImgUpload, updateNewBadgePreview,
  createBadge, renderAdminBadges, assignBadge, revokeBadgePrompt,
  deleteBadge, renderAdminStats
} from "./admin.js";
import { toast } from "./utils.js";

// ── Состояние приложения ──────────────────────────────────────────────────────
let prevScreen = "landing";
let activeTab  = "profile";

// Прокси для currentUser — модули обновляют его, app читает
function getCurrentUser() { return _cu; }

// ── Навигация ─────────────────────────────────────────────────────────────────
function showScreen(name) {
  stopMusic();
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");
  if (name === "explore")   renderExplore();
  if (name === "dashboard") {
    if (!getCurrentUser()) { openModal("loginModal"); return; }
    loadDashboard();
  }
  window.scrollTo(0, 0);
  location.hash = "";
}

function goBack() {
  stopMusic();
  showScreen(prevScreen || "landing");
}

function updateNavLoggedIn() {
  const el = document.getElementById("navActions");
  const u  = getCurrentUser();
  el.innerHTML = `
    <div class="user-chip" onclick="showScreen('dashboard')">
      <div class="user-chip-dot"></div>
      <span>@${u.username}</span>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="previewProfile()">мой профиль</button>
  `;
}

function updateNavLoggedOut() {
  document.getElementById("navActions").innerHTML = `
    <button class="btn btn-ghost" onclick="openModal('loginModal')">войти</button>
    <button class="btn btn-accent" onclick="openModal('registerModal')">создать профиль</button>
  `;
}

function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  document.getElementById(id).querySelectorAll(".form-error").forEach(e => e.classList.remove("visible"));
}
function closeModalOutside(e, id) {
  if (e.target.id === id) closeModal(id);
}
function switchModal(from, to) {
  closeModal(from);
  setTimeout(() => openModal(to), 150);
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.add("visible");
}

// ── Регистрация ──────────────────────────────────────────────────────────────
async function register() {
  const username    = document.getElementById("regUsername").value.trim().toLowerCase();
  const displayName = document.getElementById("regDisplayName").value.trim();
  const password    = document.getElementById("regPassword").value;
  const err         = document.getElementById("regError");
  const btn         = document.querySelector("#registerModal .btn-accent");

  try {
    if (btn) { btn.disabled = true; btn.textContent = "создаём..."; }
    await _register({ username, displayName, password });
    closeModal("registerModal");
    updateNavLoggedIn();
    showScreen("dashboard");
    toast("Профиль создан. Добро пожаловать.", "success");
    updateLandingStats();
  } catch(e) {
    showError(err, e.message || "Ошибка, попробуй ещё раз");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "создать профиль"; }
  }
}

// ── Вход ─────────────────────────────────────────────────────────────────────
async function login() {
  const username = document.getElementById("loginUsername").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const err      = document.getElementById("loginError");
  const btn      = document.querySelector("#loginModal .btn-accent");

  try {
    if (btn) { btn.disabled = true; btn.textContent = "входим..."; }
    await _login({ username, password });
    closeModal("loginModal");
    updateNavLoggedIn();
    showScreen("dashboard");
    toast("Добро пожаловать назад, @" + username, "success");
  } catch(e) {
    showError(err, e.message || "Ошибка, попробуй ещё раз");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "войти"; }
  }
}

// ── Выход ─────────────────────────────────────────────────────────────────────
function logout() {
  stopMusic();
  _logout();
  updateNavLoggedOut();
  showScreen("landing");
  toast("До встречи.", "success");
}

// ── Профиль ───────────────────────────────────────────────────────────────────
function previewProfile() {
  const users = getUsers();
  const u     = users[getCurrentUser()?.username];
  if (!u) return;
  prevScreen = "dashboard";
  showProfileView(u);
}

function openUserProfile(username) {
  prevScreen = "explore";
  _openUserProfile(username);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function setMobileTab(tab) {
  document.querySelectorAll(".mobile-tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("mtab-" + tab)?.classList.add("active");
}

function switchTab(tab) {
  document.querySelectorAll("[id^='tabContent-']").forEach(el => el.style.display = "none");
  document.querySelectorAll("[id^='tab-']").forEach(btn => btn.classList.remove("active"));
  document.getElementById("tabContent-" + tab).style.display = "block";
  document.getElementById("tab-" + tab)?.classList.add("active");
  activeTab = tab;
  if (tab === "appearance") initNickFontGrid();
  if (tab === "themes") { renderSavedThemes(); document.getElementById("themeExportName").value = ""; }
}

// ── Logo click (Shift+Click → admin) ─────────────────────────────────────────
function handleLogoClick(e) {
  if (e.shiftKey) {
    openAdmin();
  } else {
    stopMusic();
    showScreen("landing");
  }
}

// ── Инициализация приложения ──────────────────────────────────────────────────
async function init() {
  initAudio();

  await initFirebase();

  // Восстанавливаем сессию
  const u = await restoreSession();
  if (u) {
    updateNavLoggedIn();
  } else {
    updateNavLoggedOut();
  }

  updateLandingStats();

  // Deep link по хэшу URL
  const hash = location.hash.replace("#", "");
  if (hash && hash !== "landing") {
    const users = getUsers();
    if (users[hash]) {
      prevScreen = "explore";
      showProfileView(users[hash]);
    } else {
      showScreen("landing");
    }
  }

  // Обновлять lastSeen каждые 5 минут
  setInterval(async () => {
    const cu = getCurrentUser();
    if (cu) {
      const { saveCurrentUser } = await import("./auth.js");
      cu.lastSeen = Date.now();
      await saveCurrentUser();
    }
  }, 5 * 60 * 1000);

  // Обновлять онлайн-статусы
  setInterval(updateLandingStats, 60 * 1000);

  // Слушаем обновления из Firestore
  window.addEventListener("usersUpdated", () => {
    updateLandingStats();
    // Если открыт профиль — обновляем данные
    const vp = _vp;
    if (vp) {
      const fresh = getUsers()[vp.username];
      if (fresh) {
        const onlineRow = document.getElementById("profileOnlineRow");
        if (onlineRow) {
          onlineRow.style.display = (fresh.lastSeen && Date.now() - fresh.lastSeen < 15 * 60 * 1000) ? "flex" : "none";
        }
      }
    }
  });
}

// ── Выставляем в window только UI-функции ────────────────────────────────────
// Правило: здесь НЕЛЬЗЯ выставлять db, doc, getDocs, deleteDoc и т.д.
Object.assign(window, {
  // Навигация
  showScreen, goBack, handleLogoClick,
  openModal, closeModal, closeModalOutside, switchModal,
  setMobileTab, switchTab,

  // Auth
  register, login, logout,

  // Profile
  previewProfile, openUserProfile, showProfileView,
  react, postComment, toggleReplyForm, togglePin,
  reactComment, toggleAsSelf, togglePlay, seekMusic,

  // Dashboard
  handleAvatarUpload, handleBgUpload, selectBg, previewAccent,
  handleMusicUpload, removeMusic, saveMusicDisplayName,
  addLink, removeLink, updateLink, saveProfile,
  saveNickStyle, exportTheme, copyThemeJson,
  applyTheme, downloadSavedTheme, deleteSavedTheme,
  handleThemeFile, handleThemeDrop, importThemeFromText,

  // Admin (без доступа к Firebase напрямую)
  openAdmin, closeAdmin, switchAdminTab, toggleAdminUser,
  adminSaveRating, adminResetRating, adminToggleVerified,
  adminToggleBan, adminDeleteComment, adminDeleteUser,
  handleBadgeImgUpload, updateNewBadgePreview,
  createBadge, assignBadge, revokeBadgePrompt, deleteBadge,

  // Input events
  document_input_handler: e => {
    if (e.target.id === "newBadgeName" || e.target.id === "newBadgeEmoji") updateNewBadgePreview();
  }
});

document.addEventListener("input", window.document_input_handler);

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.open").forEach(m => m.classList.remove("open"));
    closeAdmin();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginPassword")?.addEventListener("keydown", e => { if (e.key === "Enter") login(); });
  document.getElementById("regPassword")?.addEventListener("keydown",   e => { if (e.key === "Enter") register(); });
  document.getElementById("commentText")?.addEventListener("keydown",   e => { if (e.key === "Enter") postComment(); });
  init();
});
