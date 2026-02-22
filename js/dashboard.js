// ── DASHBOARD MODULE ─────────────────────────────────────────────────────────

import { getUsers, scheduleUsersFlush, saveUser } from "./firebase.js";
import { currentUser, scheduleCurrentUserFlush } from "./auth.js";
import { escHtml, toast } from "./utils.js";
import { updateLandingStats } from "./landing.js";

export function loadDashboard() {
  const u = currentUser;
  document.getElementById("displayName").value = u.displayName || "";
  document.getElementById("userBio").value     = u.bio || "";
  updateDashAvatar();
  renderLinksList();
  document.querySelectorAll(".bg-option").forEach(o => {
    o.classList.toggle("selected", o.dataset.bg === (u.background || "default"));
    o.onclick = () => selectBg(o.dataset.bg);
  });
  document.getElementById("accentColor").value = u.accentColor || "#c8ff00";
  setTimeout(initNickFontGrid, 0);
  updateMusicUI();
}

export function updateDashAvatar() {
  const el = document.getElementById("dashAvatar");
  if (currentUser.avatar) {
    el.innerHTML = `<img src="${currentUser.avatar}" alt="avatar">`;
  } else {
    el.innerHTML = "<span>+</span>";
  }
}

export function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const SIZE = 200;
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    const scale = Math.max(SIZE / img.width, SIZE / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
    URL.revokeObjectURL(url);
    currentUser.avatar = canvas.toDataURL("image/jpeg", 0.7);
    updateDashAvatar();
    scheduleCurrentUserFlush();
    toast("Аватар загружен", "success");
  };
  img.src = url;
}

export function handleBgUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    currentUser.background = ev.target.result;
    document.querySelectorAll(".bg-option").forEach(o => o.classList.remove("selected"));
    scheduleCurrentUserFlush();
    toast("Фон загружен", "success");
  };
  reader.readAsDataURL(file);
}

export function selectBg(bg) {
  currentUser.background = bg;
  document.querySelectorAll(".bg-option").forEach(o => o.classList.toggle("selected", o.dataset.bg === bg));
  scheduleCurrentUserFlush();
}

export function previewAccent(val) {
  currentUser.accentColor = val;
  scheduleCurrentUserFlush();
}

export async function handleMusicUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const drop = document.getElementById("musicDrop");
  const icon = document.getElementById("musicDropIcon");
  const text = document.getElementById("musicDropText");
  if (drop) drop.style.opacity = "0.6";
  if (icon) icon.textContent = "◌";
  if (text) text.textContent = "загружаем на сервер...";

  try {
    const fd = new FormData();
    fd.append("reqtype", "fileupload");
    fd.append("fileToUpload", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Статус: " + res.status);
    const url = (await res.text()).trim();
    if (!url.startsWith("http")) throw new Error("Неверный ответ: " + url);

    currentUser.music     = url;
    currentUser.musicName = file.name;
    updateMusicUI();
    scheduleCurrentUserFlush();
    toast("Музыка загружена!", "success");
  } catch(err) {
    toast("Не удалось загрузить: " + (err.message || "попробуй ещё раз"), "error");
  } finally {
    if (drop) drop.style.opacity = "1";
    if (icon) icon.textContent = "◎";
    if (text) text.textContent = "нажми или перетащи mp3 / wav / ogg файл";
  }
}

export function removeMusic() {
  currentUser.music = ""; currentUser.musicName = "";
  updateMusicUI();
  scheduleCurrentUserFlush();
  toast("Трек удалён", "success");
}

export function saveMusicDisplayName() {
  currentUser.musicDisplayName = document.getElementById("musicDisplayName")?.value || "";
  scheduleCurrentUserFlush();
}

export function updateMusicUI() {
  const drop = document.getElementById("musicDrop");
  const name = document.getElementById("musicFileName");
  const removeBtn = document.getElementById("removeMusicBtn");
  const displayNameInput = document.getElementById("musicDisplayName");
  if (currentUser.music) {
    if (drop) drop.classList.add("has-file");
    if (name) name.textContent = "// " + (currentUser.musicName || "трек загружен");
    if (removeBtn) removeBtn.style.display = "inline-flex";
    if (displayNameInput) displayNameInput.value = currentUser.musicDisplayName || currentUser.musicName || "";
  } else {
    if (drop) drop.classList.remove("has-file");
    if (name) name.textContent = "";
    if (removeBtn) removeBtn.style.display = "none";
    if (displayNameInput) displayNameInput.value = "";
  }
}

export function renderLinksList() {
  const list = document.getElementById("linksList");
  list.innerHTML = "";
  (currentUser.links || []).forEach((link, i) => {
    const item = document.createElement("div");
    item.className = "link-item";
    item.innerHTML = `
      <input class="form-input" placeholder="Название (напр. Twitter)" value="${escHtml(link.label)}" oninput="updateLink(${i},'label',this.value)">
      <input class="form-input" placeholder="https://..." value="${escHtml(link.url)}" oninput="updateLink(${i},'url',this.value)">
      <button class="remove-btn" onclick="removeLink(${i})">×</button>`;
    list.appendChild(item);
  });
}

export function addLink() {
  if (!currentUser.links) currentUser.links = [];
  currentUser.links.push({ label: "", url: "" });
  renderLinksList();
}

export function removeLink(i) {
  currentUser.links.splice(i, 1);
  renderLinksList();
  scheduleCurrentUserFlush();
}

export function updateLink(i, key, val) {
  if (currentUser.links?.[i]) currentUser.links[i][key] = val;
}

export function saveProfile() {
  currentUser.displayName = document.getElementById("displayName").value.trim() || currentUser.displayName;
  currentUser.bio         = document.getElementById("userBio").value.trim();
  currentUser.accentColor = document.getElementById("accentColor").value;

  const users = getUsers();
  users[currentUser.username] = currentUser;
  scheduleUsersFlush(users);
  toast("Сохранено", "success");
  updateLandingStats();
}

// ── Nick style ──────────────────────────────────────────────────────────────

export function initNickFontGrid() {
  const grid = document.getElementById("nickFontGrid");
  if (!grid) return;
  const opts = grid.querySelectorAll(".nick-font-option");
  opts.forEach(o => {
    o.classList.toggle("selected", o.dataset.font === (currentUser.nickFont || "JetBrains Mono"));
    o.onclick = () => {
      opts.forEach(x => x.classList.remove("selected"));
      o.classList.add("selected");
      currentUser.nickFont = o.dataset.font;
      saveNickStyle();
    };
  });
  const colorInput = document.getElementById("nickColor");
  if (colorInput) colorInput.value = currentUser.nickColor || "#c8ff00";
  updateNickPreview();
}

export function saveNickStyle() {
  currentUser.nickFont  = document.querySelector("#nickFontGrid .nick-font-option.selected")?.dataset.font || "JetBrains Mono";
  currentUser.nickColor = document.getElementById("nickColor")?.value || "#c8ff00";
  scheduleCurrentUserFlush();
  updateNickPreview();
}

export function updateNickPreview() {
  const prev = document.getElementById("nickPreview");
  if (!prev || !currentUser) return;
  prev.style.color      = currentUser.nickColor || "#c8ff00";
  prev.style.fontFamily = `'${currentUser.nickFont || "JetBrains Mono"}', monospace, sans-serif`;
  prev.textContent = "@" + currentUser.username;
}

// ── Темы ─────────────────────────────────────────────────────────────────────

const THEME_FIELDS = ["accentColor", "background", "nickColor", "nickFont"];

function buildThemeObject() {
  const name  = document.getElementById("themeExportName")?.value.trim() || "void-theme";
  const theme = { _void: true, themeName: name, exportedAt: new Date().toISOString(), author: currentUser?.username || "unknown" };
  THEME_FIELDS.forEach(f => {
    theme[f] = (f === "background" && currentUser[f]?.startsWith("data:")) ? "default" : (currentUser[f] || null);
  });
  theme.links = (currentUser.links || []).map(l => ({ label: l.label, url: l.url }));
  theme.bio   = currentUser.bio || "";
  return theme;
}

export function exportTheme() {
  if (!currentUser) return;
  const theme = buildThemeObject();
  const blob  = new Blob([JSON.stringify(theme, null, 2)], { type: "application/json" });
  const url   = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (theme.themeName.replace(/\s+/g, "-").toLowerCase() || "void-theme") + ".hood";
  a.click();
  URL.revokeObjectURL(url);
  saveThemeLocally(theme);
  toast("Тема скачана!", "success");
}

export function copyThemeJson() {
  if (!currentUser) return;
  const theme = buildThemeObject();
  const json  = JSON.stringify(theme, null, 2);
  const ta    = document.getElementById("themeJsonText");
  const out   = document.getElementById("themeJsonOut");
  ta.value = json;
  out.style.display = "block";
  navigator.clipboard?.writeText(json).then(() => toast("JSON скопирован", "success")).catch(() => {
    ta.select();
    toast("Выдели и скопируй вручную", "success");
  });
  saveThemeLocally(theme);
}

function saveThemeLocally(theme) {
  try {
    const saved = JSON.parse(localStorage.getItem("hood_themes") || "[]");
    const idx   = saved.findIndex(t => t.themeName === theme.themeName);
    if (idx >= 0) saved[idx] = theme; else saved.unshift(theme);
    localStorage.setItem("hood_themes", JSON.stringify(saved.slice(0, 30)));
    renderSavedThemes();
  } catch {}
}

export function renderSavedThemes() {
  const list   = document.getElementById("savedThemesList");
  if (!list) return;
  const themes = getSavedThemes();
  if (!themes.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--text-dim);font-family:\'JetBrains Mono\',monospace">нет сохранённых тем</div>';
    return;
  }
  list.innerHTML = themes.map((t, i) => {
    const accent = t.accentColor || "#c8ff00";
    const bg     = t.background?.startsWith("data:") ? "#111" : (t.background || "#080808");
    return `<div class="theme-card">
      <div class="theme-swatch">
        <div class="theme-swatch-cell" style="background:${escHtml(bg)}"></div>
        <div class="theme-swatch-cell" style="background:${escHtml(accent)}"></div>
        <div class="theme-swatch-cell" style="background:${escHtml(accent)}22"></div>
        <div class="theme-swatch-cell" style="background:#111"></div>
      </div>
      <div class="theme-card-info">
        <div class="theme-card-name">${escHtml(t.themeName)}</div>
        <div class="theme-card-meta">by @${escHtml(t.author || "?")} · ${t.exportedAt ? new Date(t.exportedAt).toLocaleDateString("ru") : ""}</div>
      </div>
      <div class="theme-card-actions">
        <button class="btn btn-accent btn-sm" onclick="applyTheme(${i})">применить</button>
        <button class="btn btn-ghost btn-sm" onclick="downloadSavedTheme(${i})">↓</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSavedTheme(${i})">×</button>
      </div>
    </div>`;
  }).join("");
}

function getSavedThemes() {
  try { return JSON.parse(localStorage.getItem("hood_themes") || "[]"); } catch { return []; }
}

export function applyTheme(idx) {
  const t = getSavedThemes()[idx];
  if (!t || !currentUser) return;
  THEME_FIELDS.forEach(f => { if (t[f] != null) currentUser[f] = t[f]; });
  scheduleCurrentUserFlush();
  loadDashboard();
  toast(`Тема «${t.themeName}» применена`, "success");
}

export function downloadSavedTheme(idx) {
  const t = getSavedThemes()[idx];
  if (!t) return;
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = t.themeName.replace(/\s+/g, "-").toLowerCase() + ".hood";
  a.click(); URL.revokeObjectURL(url);
}

export function deleteSavedTheme(idx) {
  const themes = getSavedThemes(); themes.splice(idx, 1);
  localStorage.setItem("hood_themes", JSON.stringify(themes));
  renderSavedThemes(); toast("Тема удалена", "success");
}

export function handleThemeFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { document.getElementById("themeJsonIn").value = ev.target.result; importThemeFromText(); };
  reader.readAsText(file);
}

export function handleThemeDrop(e) {
  e.preventDefault();
  document.getElementById("themeDropZone").classList.remove("drag");
  const file = e.dataTransfer.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { document.getElementById("themeJsonIn").value = ev.target.result; importThemeFromText(); };
  reader.readAsText(file);
}

export function importThemeFromText() {
  const raw = document.getElementById("themeJsonIn")?.value.trim();
  if (!raw) { toast("Вставь JSON темы", "error"); return; }
  let theme;
  try { theme = JSON.parse(raw); } catch { toast("Неверный формат JSON", "error"); return; }
  if (!theme || typeof theme !== "object") { toast("Неверный формат темы", "error"); return; }
  let applied = 0;
  THEME_FIELDS.forEach(f => { if (theme[f] != null) { currentUser[f] = theme[f]; applied++; } });
  if (!applied) { toast("В теме нет полей оформления", "error"); return; }
  if (!theme.themeName) theme.themeName = "импортированная тема";
  theme._void = true;
  if (!theme.exportedAt) theme.exportedAt = new Date().toISOString();
  scheduleCurrentUserFlush();
  saveThemeLocally(theme);
  loadDashboard();
  document.getElementById("themeJsonIn").value = "";
  toast(`Тема «${theme.themeName}» применена!`, "success");
}
