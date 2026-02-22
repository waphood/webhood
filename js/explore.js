// ── EXPLORE MODULE ───────────────────────────────────────────────────────────

import { getUsers } from "./firebase.js";
import { escHtml } from "./utils.js";
import { showProfileView, viewingProfile } from "./profile.js";

export function renderExplore() {
  const users = getUsers();
  const grid  = document.getElementById("exploreGrid");
  const list  = Object.values(users).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:60px 0"><div class="empty-state-icon">◌</div><div class="empty-state-text">пока нет профилей.<br>создай первый.</div></div>`;
    return;
  }

  grid.innerHTML = list.map(u => {
    let bgStyle = "background: #111;";
    if (u.background?.startsWith("data:")) {
      bgStyle = `background: url(${u.background}) center/cover;`;
    }
    const avaHtml = u.avatar
      ? `<img src="${u.avatar}" alt="ava">`
      : `<span style="font-size:20px;color:var(--text-dim)">${u.displayName ? u.displayName[0] : "?"}</span>`;
    return `
      <div class="explore-card" onclick="openUserProfile('${escHtml(u.username)}')">
        <div class="explore-card-bg" style="${bgStyle}"></div>
        <div class="explore-card-body">
          <div class="explore-card-avatar">${avaHtml}</div>
          <div class="explore-card-name">${escHtml(u.displayName || u.username)}</div>
          <div class="explore-card-handle">@${escHtml(u.username)}</div>
          <div class="explore-card-stats">
            <span>+${u.likes || 0}</span>
            <span>${(u.links || []).length} links</span>
            <span>${(u.comments || []).length} comments</span>
          </div>
        </div>
      </div>`;
  }).join("");
}

export function openUserProfile(username) {
  const users = getUsers();
  const u = users[username];
  if (!u) return;
  // Устанавливаем prevScreen через app.js
  window._prevScreen = "explore";
  showProfileView(u);
}
