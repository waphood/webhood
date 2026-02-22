// ── LANDING MODULE ───────────────────────────────────────────────────────────

import { getUsers } from "./firebase.js";
import { animateNum } from "./utils.js";

export function updateLandingStats() {
  const users    = getUsers();
  const list     = Object.values(users);
  const totalLinks    = list.reduce((a, u) => a + (u.links || []).length, 0);
  const totalComments = list.reduce((a, u) => a + (u.comments || []).length, 0);
  const onlineCount   = list.filter(u => u.lastSeen && (Date.now() - u.lastSeen < 15 * 60 * 1000)).length;
  animateNum("statUsers",    list.length);
  animateNum("statLinks",    totalLinks);
  animateNum("statComments", totalComments);
  const onlineEl = document.getElementById("statOnline");
  if (onlineEl) animateNum("statOnline", onlineCount);
}
