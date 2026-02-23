// ── PROFILE MODULE ───────────────────────────────────────────────────────────

import { getUsers, getBadges, scheduleUsersFlush, saveUser } from "./firebase.js";
import { currentUser } from "./auth.js";
import { escHtml, timeAgo, toast, fmtTime } from "./utils.js";
import { updateLandingStats } from "./landing.js";

export let viewingProfile = null;

let audioEl    = null;
let isPlaying  = false;
let progressInterval = null;

export function initAudio() {
  audioEl = document.getElementById("audioPlayer");
}

export function showProfileView(user) {
  stopMusic();

  if (user.banned) {
    location.hash = user.username;
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("screen-profile").classList.add("active");
    let banEl = document.getElementById("bannedOverlay");
    if (!banEl) {
      banEl = document.createElement("div");
      banEl.id = "bannedOverlay";
      banEl.style.cssText = "position:fixed;inset:0;z-index:200;background:var(--bg);display:flex;align-items:center;justify-content:center;";
      document.body.appendChild(banEl);
    }
    banEl.style.display = "flex";
    banEl.innerHTML = `<div class="banned-screen">
      <div class="banned-icon">⊘</div>
      <div class="banned-title">ПРОФИЛЬ ЗАБЛОКИРОВАН</div>
      <div class="banned-sub">// этот профиль нарушил правила платформы</div>
      <button class="btn btn-ghost" style="margin-top:32px" onclick="document.getElementById('bannedOverlay').style.display='none';goBack()">← назад</button>
    </div>`;
    return;
  }

  const banEl = document.getElementById("bannedOverlay");
  if (banEl) banEl.style.display = "none";

  location.hash = user.username;
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-profile").classList.add("active");
  window.scrollTo(0, 0);

  // Счётчик просмотров (не считаем свои)
  if (!currentUser || currentUser.username !== user.username) {
    const users = getUsers();
    if (users[user.username]) {
      users[user.username].views = (users[user.username].views || 0) + 1;
      user.views = users[user.username].views;
      saveUser(users[user.username]).catch(e => console.error(e));
    }
  }

  // Берём свежие данные
  const users2 = getUsers();
  if (users2[user.username]) {
    user = users2[user.username];
    viewingProfile = user;
  }

  const accent = user.accentColor || "#c8ff00";

  // Фон
  const bg = document.getElementById("profileBg");
  bg.style.cssText = "";
  if (!user.background || user.background === "default") {
    bg.style.background = "#080808";
  } else if (user.background.startsWith("gradient")) {
    const gradients = {
      gradient1: "linear-gradient(135deg, #0a0a1a, #1a0a0a)",
      gradient2: "linear-gradient(135deg, #050510, #0a1a0a)",
      gradient3: "linear-gradient(135deg, #0f0f0f, #1a1000)",
      gradient4: "radial-gradient(ellipse at top, #1a1a2e, #000)",
      gradient5: "radial-gradient(ellipse at top, #1a0a0a, #000)",
    };
    bg.style.background = gradients[user.background] || "#080808";
  } else if (user.background === "dots") {
    bg.style.background = "#080808";
    bg.style.backgroundImage = "radial-gradient(#1e1e1e 1px, transparent 1px)";
    bg.style.backgroundSize = "16px 16px";
  } else if (user.background === "grid") {
    bg.style.background = "#080808";
    bg.style.backgroundImage = "linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)";
    bg.style.backgroundSize = "20px 20px";
  } else if (user.background.startsWith("data:")) {
    bg.style.backgroundImage = `url(${user.background})`;
    bg.style.backgroundSize = "cover";
    bg.style.backgroundPosition = "center";
  }

  document.getElementById("screen-profile").style.setProperty("--accent", accent);

  // Аватар
  const ava = document.getElementById("profileAvatar");
  if (user.avatar) {
    ava.innerHTML = `<img src="${user.avatar}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
  } else {
    ava.innerHTML = user.displayName ? user.displayName[0].toUpperCase() : "?";
    ava.style.display = "flex";
    ava.style.alignItems = "center";
    ava.style.justifyContent = "center";
  }

  document.getElementById("profileName").textContent = user.displayName || user.username;
  const handleEl = document.getElementById("profileHandle");
  handleEl.textContent = "@" + user.username;
  if (user.nickColor) handleEl.style.color = user.nickColor;
  if (user.nickFont)  handleEl.style.fontFamily = `'${user.nickFont}', monospace, sans-serif`;

  document.getElementById("profileVerified").style.display = user.verified ? "inline-flex" : "none";

  const onlineRow = document.getElementById("profileOnlineRow");
  const isOnline  = user.lastSeen && (Date.now() - user.lastSeen < 15 * 60 * 1000);
  onlineRow.style.display = isOnline ? "flex" : "none";

  document.getElementById("profileViews").textContent = user.views ? `// ${user.views} просмотров` : "";
  document.getElementById("profileBio").textContent   = user.bio || "";

  // Бейджики
  const badgesEl  = document.getElementById("profileBadges");
  const allBadges = getBadges();
  const userBadgeIds = user.badges || [];
  if (userBadgeIds.length > 0) {
    badgesEl.innerHTML = userBadgeIds.map(bid => {
      const b = allBadges[bid];
      if (!b) return "";
      const iconHtml = b.img
        ? `<img src="${b.img}" alt="${escHtml(b.name)}">`
        : `<span class="profile-badge-icon">${escHtml(b.emoji || "◈")}</span>`;
      return `<span class="profile-badge" title="${escHtml(b.name)}">${iconHtml}${escHtml(b.name)}</span>`;
    }).join("");
  } else {
    badgesEl.innerHTML = "";
  }

  // Ссылки
  const linksEl = document.getElementById("profileLinks");
  linksEl.innerHTML = "";
  (user.links || []).filter(l => l.url).forEach(link => {
    const a = document.createElement("a");
    a.className = "profile-link";
    const href = link.url.startsWith("http") ? link.url : "https://" + link.url;
    try {
      const u = new URL(href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
      a.href = u.href;
    } catch { return; }
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.innerHTML = `<span>${escHtml(link.label || link.url)}</span><span class="profile-link-arrow">→</span>`;
    linksEl.appendChild(a);
  });

  // Музыка
  const musicEl = document.getElementById("profileMusicPlayer");
  if (user.music) {
    musicEl.style.display = "block";
    musicEl.innerHTML = `
      <div class="music-player">
        <button class="play-btn" id="playPauseBtn" onclick="togglePlay()">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <div class="music-info">
          <div class="music-title">${escHtml(user.musicDisplayName || user.musicName || "Track")}</div>
          <div class="music-progress">
            <div class="progress-bar-bg" id="progressBg" onclick="seekMusic(event)">
              <div class="progress-bar-fill" id="progressFill"></div>
            </div>
          </div>
          <div class="music-time" id="musicTime">0:00 / 0:00</div>
        </div>
      </div>`;
    audioEl.src = user.music;
    audioEl.load();
    audioEl.addEventListener("timeupdate", updateProgress);
    audioEl.addEventListener("canplay", () => {
      audioEl.play().catch(() => {});
      isPlaying = true;
      const btn = document.getElementById("playPauseBtn");
      if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    }, { once: true });
  } else {
    musicEl.style.display = "none";
  }

  updateReactionDisplay(user);
  renderComments(user.comments || []);

  const toggleWrap = document.getElementById("asSelfToggleWrap");
  const asSelfCheck = document.getElementById("asSelfCheck");
  const asSelfUser  = document.getElementById("asSelfUser");
  if (currentUser) {
    toggleWrap.style.display = "block";
    asSelfCheck.checked = false;
    asSelfUser.textContent = "@" + currentUser.username;
    toggleAsSelf();
  } else {
    toggleWrap.style.display = "none";
    document.getElementById("commentNickWrap").style.display = "block";
  }
}

export function updateReactionDisplay(user) {
  document.getElementById("likeCount").textContent    = user.likes || 0;
  document.getElementById("dislikeCount").textContent = user.dislikes || 0;
  const liked = sessionStorage.getItem("reaction_" + user.username);
  document.getElementById("likeBtn").className    = "reaction-btn" + (liked === "like"    ? " liked"    : "");
  document.getElementById("dislikeBtn").className = "reaction-btn" + (liked === "dislike" ? " disliked" : "");
}

export function react(type) {
  const u   = viewingProfile;
  const key = "reaction_" + u.username;
  const prev = sessionStorage.getItem(key);
  const field = type === "like" ? "likes" : "dislikes";
  const prevField = prev === "like" ? "likes" : "dislikes";

  if (prev === type) {
    u[field] = Math.max(0, (u[field] || 0) - 1);
    sessionStorage.removeItem(key);
  } else {
    if (prev) u[prevField] = Math.max(0, (u[prevField] || 0) - 1);
    u[field] = (u[field] || 0) + 1;
    sessionStorage.setItem(key, type);
  }

  saveUser(u).catch(e => console.error(e));
  viewingProfile = u;
  updateReactionDisplay(u);
}

export function postComment(replyTo = null) {
  const asSelf = document.getElementById("asSelfCheck")?.checked && currentUser;
  let nick, text;

  if (replyTo !== null) {
    nick = currentUser ? currentUser.username : (document.getElementById(`reply-nick-${replyTo}`)?.value.trim() || "");
    text = document.getElementById(`reply-text-${replyTo}`)?.value.trim() || "";
    if (!nick) { toast("Напиши свой ник", "error"); return; }
    if (!text) { toast("Напиши ответ", "error"); return; }
  } else {
    nick = asSelf ? currentUser.username : document.getElementById("commentNick").value.trim();
    text = document.getElementById("commentText").value.trim();
    if (!nick) { toast("Напиши свой ник", "error"); return; }
    if (!text) { toast("Напиши сообщение", "error"); return; }
  }

  // Санитизация ника — только допустимые символы
  nick = nick.replace(/[<>"'&]/g, "").substring(0, 30);
  if (!nick) { toast("Недопустимый ник", "error"); return; }

  if (text.length > 300) { toast("Слишком длинно (макс 300)", "error"); return; }

  const comment = { nick, text, time: Date.now() };
  if (currentUser && (asSelf || replyTo !== null)) {
    comment.nickColor = currentUser.nickColor || "#c8ff00";
    comment.nickFont  = currentUser.nickFont  || "JetBrains Mono";
    comment.isOwner   = (currentUser.username === viewingProfile.username);
  }

  if (!viewingProfile.comments) viewingProfile.comments = [];

  if (replyTo !== null) {
    if (!viewingProfile.comments[replyTo].replies) viewingProfile.comments[replyTo].replies = [];
    viewingProfile.comments[replyTo].replies.push(comment);
    const rf = document.getElementById(`reply-form-${replyTo}`);
    if (rf) rf.classList.remove("open");
  } else {
    viewingProfile.comments.unshift(comment);
    document.getElementById("commentText").value = "";
  }

  saveUser(viewingProfile).catch(e => console.error(e));
  renderComments(viewingProfile.comments);
  toast("Отправлено", "success");
  updateLandingStats();
}

export function renderComments(comments) {
  const list = document.getElementById("commentsList");
  document.getElementById("commentsCount").textContent = comments.length;

  if (!comments.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon" style="font-size:24px">◌</div><div class="empty-state-text">пока нет комментариев.<br>будь первым.</div></div>`;
    return;
  }

  const sorted = [...comments.map((c,i) => ({...c, _origIdx: i}))].sort((a,b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const isOwner = currentUser && viewingProfile && currentUser.username === viewingProfile.username;
  const allUsers = getUsers();

  list.innerHTML = sorted.map(c => {
    const i = c._origIdx;
    const nickStyle  = c.nickColor ? `color:${c.nickColor};` : "";
    const fontStyle  = c.nickFont  ? `font-family:'${c.nickFont}',monospace,sans-serif;` : "";
    const pageTag    = c.isOwner
      ? `<span style="font-size:9px;color:var(--text-dim);font-family:'JetBrains Mono',monospace;margin-left:4px;border:1px solid var(--border);padding:1px 5px;border-radius:3px">page</span>` : "";
    const pinnedTag  = c.pinned
      ? `<span style="font-size:9px;color:var(--accent);font-family:'JetBrains Mono',monospace;margin-left:4px;border:1px solid var(--accent-border);padding:1px 5px;border-radius:3px;background:var(--accent-dim)">📌 закреп</span>` : "";
    const authorVerified = allUsers[c.nick]?.verified;
    const verifiedTag = authorVerified
      ? `<span class="verified-check" style="width:11px;height:11px;font-size:7px;margin-left:2px">✓</span>` : "";
    const cmtKey     = `cmt_react_${viewingProfile.username}_${i}`;
    const cmtReaction = sessionStorage.getItem(cmtKey);

    const repliesHtml = (c.replies?.length) ? `
      <div class="comment-replies">
        ${c.replies.map(r => {
          const rNickStyle = r.nickColor ? `color:${r.nickColor};` : "";
          const rFontStyle = r.nickFont  ? `font-family:'${r.nickFont}',monospace,sans-serif;` : "";
          const rPageTag   = r.isOwner
            ? `<span style="font-size:9px;color:var(--text-dim);font-family:'JetBrains Mono',monospace;margin-left:4px;border:1px solid var(--border);padding:1px 5px;border-radius:3px">page</span>` : "";
          const rVerified  = allUsers[r.nick]?.verified
            ? `<span class="verified-check" style="width:11px;height:11px;font-size:7px;margin-left:2px">✓</span>` : "";
          return `<div class="reply-item">
            <div class="comment-meta">
              <span class="comment-author" style="${rNickStyle}${rFontStyle}">@${escHtml(r.nick)}</span>${rVerified}${rPageTag}
              <span class="comment-time">${timeAgo(r.time)}</span>
            </div>
            <div class="comment-text">${escHtml(r.text)}</div>
          </div>`;
        }).join("")}
      </div>` : "";

    const pinBtn = isOwner
      ? `<button class="comment-reply-btn" onclick="togglePin(${i})">${c.pinned ? "📌 открепить" : "📌"}</button>` : "";

    return `
    <div class="comment-item" id="cmt-${i}" style="${c.pinned ? "border-left:2px solid var(--accent);" : ""}">
      <div class="comment-meta">
        <span class="comment-author" style="${nickStyle}${fontStyle}">@${escHtml(c.nick)}</span>${verifiedTag}${pageTag}${pinnedTag}
        <span class="comment-time">${timeAgo(c.time)}</span>
      </div>
      <div class="comment-text">${escHtml(c.text)}</div>
      <div class="comment-reactions">
        <button class="comment-react-btn${cmtReaction === "like" ? " liked" : ""}" onclick="reactComment(${i},'like')">+ <span id="clk-${i}">${c.likes || 0}</span></button>
        <button class="comment-react-btn${cmtReaction === "dislike" ? " disliked" : ""}" onclick="reactComment(${i},'dislike')">− <span id="cdk-${i}">${c.dislikes || 0}</span></button>
        <button class="comment-reply-btn" onclick="toggleReplyForm(${i})">↩ ответить</button>
        ${pinBtn}
      </div>
      <div class="reply-form" id="reply-form-${i}">
        <div id="reply-nick-wrap-${i}" ${currentUser ? 'style="display:none"' : ""}>
          <label class="form-label" style="margin-bottom:4px">ник</label>
          <input class="form-input" id="reply-nick-${i}" placeholder="anonymous" style="margin-bottom:6px;font-size:13px">
        </div>
        <div class="reply-form-row">
          <input class="form-input" id="reply-text-${i}" placeholder="твой ответ...">
          <button class="btn btn-accent btn-sm" onclick="postComment(${i})">↩</button>
        </div>
      </div>
      ${repliesHtml}
    </div>`;
  }).join("");
}

export function toggleReplyForm(i) {
  const rf = document.getElementById(`reply-form-${i}`);
  if (!rf) return;
  rf.classList.toggle("open");
  if (rf.classList.contains("open")) {
    if (currentUser) {
      const nw = document.getElementById(`reply-nick-wrap-${i}`);
      if (nw) nw.style.display = "none";
    }
    document.getElementById(`reply-text-${i}`)?.focus();
  }
}

export function togglePin(i) {
  if (!currentUser || !viewingProfile || currentUser.username !== viewingProfile.username) return;
  const c = viewingProfile.comments[i];
  if (!c) return;
  viewingProfile.comments.forEach((cm, j) => { if (j !== i) cm.pinned = false; });
  c.pinned = !c.pinned;
  saveUser(viewingProfile).catch(e => console.error(e));
  renderComments(viewingProfile.comments);
}

export function reactComment(idx, type) {
  const u = viewingProfile;
  if (!u?.comments?.[idx]) return;
  const cmtKey = `cmt_react_${u.username}_${idx}`;
  const prev   = sessionStorage.getItem(cmtKey);
  const c      = u.comments[idx];
  const field     = type === "like" ? "likes" : "dislikes";
  const prevField = prev === "like" ? "likes" : "dislikes";

  if (prev === type) {
    c[field] = Math.max(0, (c[field] || 0) - 1);
    sessionStorage.removeItem(cmtKey);
  } else {
    if (prev) c[prevField] = Math.max(0, (c[prevField] || 0) - 1);
    c[field] = (c[field] || 0) + 1;
    sessionStorage.setItem(cmtKey, type);
  }

  u.comments[idx] = c;
  saveUser(u).catch(e => console.error(e));
  viewingProfile = u;
  renderComments(u.comments);
}

export function toggleAsSelf() {
  const asSelf  = document.getElementById("asSelfCheck")?.checked;
  const nickWrap = document.getElementById("commentNickWrap");
  if (!nickWrap) return;
  nickWrap.style.display = (asSelf && currentUser) ? "none" : "block";
}

// ── Музыка ───────────────────────────────────────────────────────────────────

export function togglePlay() {
  if (!audioEl) return;
  if (isPlaying) {
    audioEl.pause();
    isPlaying = false;
    document.getElementById("playPauseBtn").innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  } else {
    audioEl.play().catch(() => {});
    isPlaying = true;
    document.getElementById("playPauseBtn").innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
  }
}

export function stopMusic() {
  if (!audioEl) return;
  audioEl.pause();
  audioEl.currentTime = 0;
  audioEl.src = "";
  isPlaying = false;
}

function updateProgress() {
  if (!audioEl?.duration) return;
  const pct  = (audioEl.currentTime / audioEl.duration) * 100;
  const fill = document.getElementById("progressFill");
  const time = document.getElementById("musicTime");
  if (fill) fill.style.width = pct + "%";
  if (time) time.textContent = `${fmtTime(audioEl.currentTime)} / ${fmtTime(audioEl.duration)}`;
}

export function seekMusic(e) {
  const bg = document.getElementById("progressBg");
  if (!bg || !audioEl?.duration) return;
  const rect = bg.getBoundingClientRect();
  audioEl.currentTime = ((e.clientX - rect.left) / rect.width) * audioEl.duration;
}
