// ── UTILS MODULE ─────────────────────────────────────────────────────────────

export function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000)    return "только что";
  if (diff < 3600000)  return Math.floor(diff / 60000)   + " мин назад";
  if (diff < 86400000) return Math.floor(diff / 3600000)  + " ч назад";
  return Math.floor(diff / 86400000) + " д назад";
}

export function toast(msg, type = "success") {
  const c = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-dot"></div><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transition = "opacity 0.3s";
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

export function animateNum(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 20));
  const iv = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(iv);
  }, 40);
}

export function fmtTime(s) {
  if (isNaN(s)) return "0:00";
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Безопасная валидация URL для ссылок
export function sanitizeUrl(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "#";
    return u.href;
  } catch {
    return "#";
  }
}
