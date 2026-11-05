// Menus as DOM overlays: title, level-up choice, pause, game over. Korean text needs a real font, so these are
// HTML rather than pixel text on the canvas.

import { TAG_COLOR } from "./config.js";
import { input } from "./input.js";

const $ = (id) => document.getElementById(id);
const screens = ["title", "level", "pause", "over"];

export function show(name) {
  for (const s of screens) $("ov-" + s).hidden = s !== name;
  document.body.classList.toggle("playing", name === null);
  document.body.dataset.screen = name ?? "play";
}

const BEST_KEY = "frostwizard.best";
export function loadBest() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY)) ?? { score: 0, wave: 0 };
  } catch {
    return { score: 0, wave: 0 };
  }
}
export function saveBest(b) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(b));
  } catch {}
}

export function setupTitle(onStart) {
  const best = loadBest();
  $("title-best").textContent = best.score ? `최고 기록 · 웨이브 ${best.wave} · ${best.score.toLocaleString()}점` : "첫 판을 시작해 보세요";
  $("controls-touch").hidden = !input.touch;
  $("controls-desk").hidden = input.touch;
  $("btn-start").onclick = onStart;
}

export function showLevelUp(level, choices, taken, onPick) {
  $("level-title").textContent = `레벨 ${level}`;
  const list = $("level-cards");
  list.replaceChildren();
  choices.forEach((u, i) => {
    const b = document.createElement("button");
    b.className = "card";
    b.id = "card-" + i;
    b.style.setProperty("--tag", TAG_COLOR[u.tag]);
    const have = taken[u.id] ?? 0;
    b.innerHTML = `<span class="chip">${u.tag}</span><span class="card-name"></span><span class="card-desc"></span><span class="pips">${"■".repeat(have)}<i>${"■".repeat(u.max - have)}</i></span><kbd>${i + 1}</kbd>`;
    b.querySelector(".card-name").textContent = u.name;
    b.querySelector(".card-desc").textContent = u.desc;
    b.onclick = () => onPick(u);
    list.append(b);
  });
  show("level");
}

export function showOver(stats, isBest, onRetry, onMenu) {
  $("over-wave").textContent = stats.wave;
  $("over-level").textContent = stats.level;
  $("over-kills").textContent = stats.kills;
  $("over-time").textContent = `${Math.floor(stats.time / 60)}:${String(Math.floor(stats.time % 60)).padStart(2, "0")}`;
  $("over-score").textContent = stats.score.toLocaleString();
  $("over-best").hidden = !isBest;
  $("btn-retry").onclick = onRetry;
  $("btn-menu").onclick = onMenu;
  show("over");
}

export function setupPause(onResume, onQuit, onMute, muted) {
  $("btn-resume").onclick = onResume;
  $("btn-quit").onclick = onQuit;
  $("btn-mute").onclick = onMute;
  $("btn-mute").textContent = muted ? "소리 켜기" : "소리 끄기";
}
