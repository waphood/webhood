// ── ADMIN MODULE ─────────────────────────────────────────────────────────────
// Панель администратора. Пароль проверяется через хэш с солью.
// Хэш хранится в коде, но с солью — rainbow tables бесполезны.

import { getUsers, scheduleUsersFlush, getBadges, saveBadges, saveUser, deleteCurrentUser } from "./firebase.js";
import { escHtml, toast } from "./utils.js";
import { currentUser, logout } from "./auth.js";
import { viewingProfile, updateReactionDisplay, renderComments } from "./profile.js";
import { openUserProfile } from "./explore.js";
import { updateLandingStats } from "./landing.js";

// ── Пароль администратора ──────────────────────────────────────────────────
// Чтобы сменить пароль:
// 1. Открой консоль браузера на HTTPS
// 2. Выполни: const SALT="wh_admin_s4lt_v2"; const pass="твой_пароль";
//    const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(SALT+pass+SALT));
//    console.log(Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join(""))
// 3. Замени ADMIN_HASH ниже на полученный хэш.
const ADMIN_SALT = "wh_admin_s4lt_v2";
const ADMIN_HASH = "73274a70eb3302468c50e70e9ee5c0f95e713f17ae319dcea1670353828d5563"; // см. инструкцию выше

let _adminOpen = false;

async function checkAdminPassword(entered) {
  if (window.crypto?.subtle) {
    try {
      const buf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(ADMIN_SALT + entered + ADMIN_SALT)
      );
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("") === ADMIN_HASH;
    } catch(e) {}
  }
  // Fallback (HTTP)
  let h = 5381;
  const s = ADMIN_SALT + entered + ADMIN_SALT;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  const fallback = "fb_" + (h >>> 0).toString(16).padStart(8, "0") + s.length.toString(16);
  return fallback === ADMIN_HASH;
}

export async function openAdmin() {
  const entered = prompt("Пароль:");
  if (entered === null) return;

  const ok = await checkAdminPassword(entered);
  if (!ok) { toast("Неверный пароль", "error"); return; }

  _adminOpen = true;
  document.getElementById("adminOverlay").classList.add("open");
  renderAdminUsers();
}

export function closeAdmin() {
  _adminOpen = false;
  document.getElementById("adminOverlay").classList.remove("open");
}

export function switchAdminTab(tab) {
  document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".admin-tab-pane").forEach(p => p.classList.remove("active"));
  document.getElementById("adminTab" + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add("active");
  event.target.classList.add("active");
  if (tab === "badges") renderAdminBadges();
  if (tab === "stats")  renderAdminStats();
}

export function renderAdminUsers() {
  const users = getUsers();
  const list = Object.values(users).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const container = document.getElementById("adminUsersList");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:13px;font-family:JetBrains Mono,monospace">// нет профилей</div>';
    return;
  }

  container.innerHTML = list.map((u, i) => `
    <div class="admin-user-card" style="${u.banned ? "opacity:0.5;border-color:rgba(255,68,68,0.4)" : ""}">
      <div class="admin-user-header" onclick="toggleAdminUser('aub-${u.username}')">
        <div class="admin-user-info">
          <div>
            <div class="admin-user-name">${escHtml(u.displayName || u.username)} ${u.verified ? '<span class="verified-check" style="font-size:8px">✓</span>' : ''} ${u.banned ? '<span style="font-size:10px;color:var(--danger);font-family:JetBrains Mono,monospace">BANNED</span>' : ''}</div>
            <div class="admin-user-handle">@${escHtml(u.username)}</div>
          </div>
        </div>
        <div class="admin-user-stats">
          +${u.likes || 0} / −${u.dislikes || 0} &nbsp;|&nbsp; ${(u.comments || []).length} cmts &nbsp;|&nbsp; ${u.views || 0} views
        </div>
      </div>
      <div class="admin-user-body" id="aub-${u.username}">
        <div class="admin-section-title">// рейтинг</div>
        <div class="admin-rating-row">
          <div class="admin-rating-field">
            <label>LIKES</label>
            <input type="number" value="${u.likes || 0}" id="adm-likes-${u.username}" min="0">
          </div>
          <div class="admin-rating-field">
            <label>DISLIKES</label>
            <input type="number" value="${u.dislikes || 0}" id="adm-dislikes-${u.username}" min="0">
          </div>
          <div class="admin-rating-field" style="align-self:flex-end">
            <button class="btn btn-ghost btn-sm" onclick="adminSaveRating('${u.username}')">сохранить</button>
            <button class="btn btn-ghost btn-sm" onclick="adminResetRating('${u.username}')">сбросить</button>
          </div>
        </div>
        <div class="admin-section-title" style="margin-top:16px">// действия</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="btn btn-ghost btn-sm" onclick="adminToggleVerified('${u.username}')">${u.verified ? "снять верификацию" : "верифицировать"}</button>
          <button class="btn ${u.banned ? "btn-ghost" : "btn-danger"} btn-sm" onclick="adminToggleBan('${u.username}')">${u.banned ? "разбанить" : "забанить"}</button>
          <button class="btn btn-danger btn-sm" onclick="adminDeleteUser('${u.username}')">удалить профиль</button>
        </div>
        <div class="admin-section-title" style="margin-top:16px">// комментарии (${(u.comments || []).length})</div>
        <div>
          ${(u.comments || []).slice(0, 5).map((c, ci) => `
            <div class="admin-comment-item">
              <span class="admin-comment-nick">@${escHtml(c.nick)}</span>
              <span class="admin-comment-text">${escHtml(c.text.substring(0, 80))}${c.text.length > 80 ? "..." : ""}</span>
              <button class="admin-comment-del" onclick="adminDeleteComment('${u.username}', ${ci})">×</button>
            </div>
          `).join("") || '<div style="font-size:12px;color:var(--text-dim);font-family:JetBrains Mono,monospace">нет комментариев</div>'}
        </div>
      </div>
    </div>
  `).join("");
}

export function toggleAdminUser(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("open");
}

export function adminSaveRating(username) {
  const users = getUsers();
  const u = users[username];
  if (!u) return;
  u.likes    = Math.max(0, parseInt(document.getElementById("adm-likes-" + username)?.value) || 0);
  u.dislikes = Math.max(0, parseInt(document.getElementById("adm-dislikes-" + username)?.value) || 0);
  saveUser(u).catch(e => console.error(e));
  if (viewingProfile?.username === username) updateReactionDisplay(u);
  toast("Рейтинг обновлён", "success");
  renderAdminUsers();
}

export function adminResetRating(username) {
  const users = getUsers();
  const u = users[username];
  if (!u) return;
  u.likes = 0; u.dislikes = 0;
  users[username] = u;
  saveUser(u).catch(e => console.error(e));
  if (viewingProfile?.username === username) updateReactionDisplay(u);
  toast("Рейтинг сброшен", "success");
  renderAdminUsers();
}

export function adminToggleVerified(username) {
  const users = getUsers();
  const u = users[username];
  if (!u) return;
  u.verified = !u.verified;
  users[username] = u;
  saveUser(u).catch(e => console.error(e));
  toast(u.verified ? `@${username} верифицирован ✓` : `Верификация снята с @${username}`, "success");
  renderAdminUsers();
}

export function adminToggleBan(username) {
  const users = getUsers();
  const u = users[username];
  if (!u) return;
  u.banned = !u.banned;
  users[username] = u;
  saveUser(u).catch(e => console.error(e));
  if (u.banned && currentUser?.username === username) logout();
  toast(u.banned ? `@${username} заблокирован` : `@${username} разблокирован`, u.banned ? "error" : "success");
  renderAdminUsers();
}

export function adminDeleteComment(username, idx) {
  const users = getUsers();
  const u = users[username];
  if (!u || !u.comments) return;
  u.comments.splice(idx, 1);
  users[username] = u;
  saveUser(u).catch(e => console.error(e));
  if (viewingProfile?.username === username) {
    Object.assign(viewingProfile, u);
    renderComments(u.comments);
  }
  toast("Комментарий удалён", "success");
  renderAdminUsers();
}

export function adminDeleteUser(username) {
  if (!confirm("Удалить профиль @" + username + "? Это необратимо.")) return;
  const users = getUsers();
  delete users[username];
  deleteCurrentUser(username).catch(e => console.error(e));
  if (currentUser?.username === username) logout();
  toast("Профиль @" + username + " удалён", "success");
  renderAdminUsers();
  updateLandingStats();
}

// ── Бейджики ──────────────────────────────────────────────────────────────
let _newBadgeImg = "";

export function handleBadgeImgUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    _newBadgeImg = ev.target.result;
    const el = document.getElementById("badgeImgName");
    if (el) el.textContent = file.name;
    updateNewBadgePreview();
  };
  reader.readAsDataURL(file);
}

export function updateNewBadgePreview() {
  const name  = document.getElementById("newBadgeName")?.value || "новый бейджик";
  const emoji = document.getElementById("newBadgeEmoji")?.value || "◈";
  const prev  = document.getElementById("newBadgePreview");
  if (!prev) return;
  const iconHtml = _newBadgeImg
    ? `<img src="${_newBadgeImg}" style="width:14px;height:14px;border-radius:50%;object-fit:cover">`
    : `<span>${emoji || "◈"}</span>`;
  prev.innerHTML = `${iconHtml} ${escHtml(name)}`;
}

export async function createBadge() {
  const name  = document.getElementById("newBadgeName")?.value.trim();
  const emoji = document.getElementById("newBadgeEmoji")?.value.trim() || "◈";
  if (!name) { toast("Введи название бейджика", "error"); return; }

  const badges = getBadges();
  const id = "b_" + Date.now();
  badges[id] = { id, name, emoji, img: _newBadgeImg, createdAt: Date.now() };
  await saveBadges(badges);

  document.getElementById("newBadgeName").value  = "";
  document.getElementById("newBadgeEmoji").value = "";
  document.getElementById("badgeImgName").textContent = "";
  document.getElementById("newBadgePreview").innerHTML = "◈ новый бейджик";
  _newBadgeImg = "";
  document.getElementById("badgeImgInput").value = "";

  toast("Бейджик создан", "success");
  renderAdminBadges();
}

export function renderAdminBadges() {
  const badges = getBadges();
  const container = document.getElementById("adminBadgeList");
  if (!container) return;
  const list = Object.values(badges);
  if (!list.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--text-dim);font-family:JetBrains Mono,monospace">нет бейджиков</div>';
    return;
  }
  container.innerHTML = list.map(b => {
    const iconHtml = b.img
      ? `<img src="${b.img}">`
      : `<span>${escHtml(b.emoji || "◈")}</span>`;
    return `
      <div class="badge-admin-item">
        <span class="badge-admin-preview">${iconHtml} ${escHtml(b.name)}</span>
        <div class="badge-assign-row">
          <input class="form-input" placeholder="@username" id="assign-${b.id}" style="font-family:'JetBrains Mono',monospace;font-size:12px">
          <button class="btn btn-accent btn-sm" onclick="assignBadge('${b.id}')">выдать</button>
          <button class="btn btn-ghost btn-sm" onclick="revokeBadgePrompt('${b.id}')">забрать</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBadge('${b.id}')">удалить</button>
        </div>
      </div>`;
  }).join("");
}

export async function assignBadge(badgeId) {
  const input = document.getElementById("assign-" + badgeId);
  if (!input) return;
  const username = input.value.trim().replace("@", "").toLowerCase();
  if (!username) { toast("Введи @username", "error"); return; }
  const users = getUsers();
  const u = users[username];
  if (!u) { toast("Профиль @" + username + " не найден", "error"); return; }
  if (!u.badges) u.badges = [];
  if (u.badges.includes(badgeId)) { toast("Уже есть у пользователя", "error"); return; }
  u.badges.push(badgeId);
  users[username] = u;
  saveUser(u).catch(e => console.error(e));
  input.value = "";
  toast("Бейджик выдан @" + username, "success");
}

export function revokeBadgePrompt(badgeId) {
  const username = prompt("Забрать бейджик у какого пользователя? (@username)");
  if (!username) return;
  const uname = username.trim().replace("@","").toLowerCase();
  const users = getUsers();
  const u = users[uname];
  if (!u) { toast("Профиль не найден", "error"); return; }
  u.badges = (u.badges || []).filter(id => id !== badgeId);
  users[uname] = u;
  saveUser(u).catch(e => console.error(e));
  toast("Бейджик забран у @" + uname, "success");
}

export async function deleteBadge(badgeId) {
  if (!confirm("Удалить бейджик? Он пропадёт у всех пользователей.")) return;
  const badges = getBadges();
  delete badges[badgeId];
  await saveBadges(badges);
  const users = getUsers();
  Object.values(users).forEach(u => {
    if (u.badges) {
      u.badges = u.badges.filter(id => id !== badgeId);
      saveUser(u).catch(e => console.error(e));
    }
  });
  toast("Бейджик удалён", "success");
  renderAdminBadges();
}

export function renderAdminStats() {
  const users = getUsers();
  const list = Object.values(users);
  const container = document.getElementById("adminStatsContent");
  if (!container) return;

  const totalUsers    = list.length;
  const totalComments = list.reduce((a, u) => a + (u.comments || []).length, 0);
  const totalViews    = list.reduce((a, u) => a + (u.views || 0), 0);
  const totalLikes    = list.reduce((a, u) => a + (u.likes || 0), 0);
  const banned        = list.filter(u => u.banned).length;
  const verified      = list.filter(u => u.verified).length;

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("ru", { weekday: "short" });
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const end   = start + 86400000;
    const count = list.filter(u => u.createdAt >= start && u.createdAt < end).length;
    days.push({ label, count });
  }
  const maxDay = Math.max(...days.map(d => d.count), 1);

  const topLikes = [...list].sort((a,b) => (b.likes||0) - (a.likes||0)).slice(0,5);
  const topViews = [...list].sort((a,b) => (b.views||0) - (a.views||0)).slice(0,5);

  container.innerHTML = `
    <div class="admin-stats-grid">
      <div class="admin-stat-card"><div class="admin-stat-num">${totalUsers}</div><div class="admin-stat-label">профилей</div></div>
      <div class="admin-stat-card"><div class="admin-stat-num">${totalComments}</div><div class="admin-stat-label">комментариев</div></div>
      <div class="admin-stat-card"><div class="admin-stat-num">${totalViews}</div><div class="admin-stat-label">просмотров</div></div>
      <div class="admin-stat-card"><div class="admin-stat-num">${totalLikes}</div><div class="admin-stat-label">лайков</div></div>
      <div class="admin-stat-card"><div class="admin-stat-num">${verified}</div><div class="admin-stat-label">верифицировано</div></div>
      <div class="admin-stat-card"><div class="admin-stat-num" style="color:var(--danger)">${banned}</div><div class="admin-stat-label">забанено</div></div>
    </div>
    <div class="admin-chart-wrap">
      <div class="admin-chart-title">// регистрации за 7 дней</div>
      <div class="admin-bar-chart">
        ${days.map(d => `
          <div class="admin-bar-col">
            <div class="admin-bar" style="height:${Math.round((d.count/maxDay)*100)}%" title="${d.count} рег."></div>
            <div class="admin-bar-label">${d.label}</div>
          </div>`).join("")}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="admin-chart-wrap">
        <div class="admin-chart-title">// топ по лайкам</div>
        <div class="admin-top-list">
          ${topLikes.map((u,i) => `
            <div class="admin-top-item" onclick="closeAdmin();openUserProfile('${u.username}')">
              <span class="admin-top-rank">#${i+1}</span>
              <span class="admin-top-name">${escHtml(u.displayName||u.username)}</span>
              <span class="admin-top-stat">+${u.likes||0}</span>
            </div>`).join("") || '<div style="font-size:12px;color:var(--text-dim)">нет данных</div>'}
        </div>
      </div>
      <div class="admin-chart-wrap">
        <div class="admin-chart-title">// топ по просмотрам</div>
        <div class="admin-top-list">
          ${topViews.map((u,i) => `
            <div class="admin-top-item" onclick="closeAdmin();openUserProfile('${u.username}')">
              <span class="admin-top-rank">#${i+1}</span>
              <span class="admin-top-name">${escHtml(u.displayName||u.username)}</span>
              <span class="admin-top-stat">${u.views||0} views</span>
            </div>`).join("") || '<div style="font-size:12px;color:var(--text-dim)">нет данных</div>'}
        </div>
      </div>
    </div>`;
}
