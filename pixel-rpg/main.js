// Frost Wizard: a top-down pixel action RPG. A wizard with frost magic and an air force on call holds out
// against waves of slimes, bats and skeleton archers, with a King Slime every fifth wave.

import { setView } from "./config.js";
import { G, newRun, update, upgradeChoices, takeUpgrade } from "./game.js";
import { initRender, draw } from "./render.js";
import { input, initInput, endFrame, tappedKey, setButtonCooldown } from "./input.js";
import { show, setupTitle, showLevelUp, showOver, setupPause, loadBest, saveBest } from "./ui.js";
import { unlockAudio, setMuted, isMuted, sfx } from "./audio.js";

const canvas = document.getElementById("game");
initRender(canvas);
initInput({ canvas, onFirstInput: unlockAudio });

try {
  setMuted(localStorage.getItem("frostwizard.muted") === "1");
} catch {}

let choices = [];

function toTitle() {
  newRun("title");
  setupTitle(start);
  show("title");
}
function start() {
  sfx.click();
  newRun("play");
  show(null);
}
function pause() {
  if (G.mode !== "play") return;
  G.mode = "paused";
  setupPause(resume, toTitle, toggleMute, isMuted());
  show("pause");
}
function resume() {
  G.mode = "play";
  show(null);
}
function toggleMute() {
  setMuted(!isMuted());
  try {
    localStorage.setItem("frostwizard.muted", isMuted() ? "1" : "0");
  } catch {}
  if (G.mode === "paused") setupPause(resume, toTitle, toggleMute, isMuted());
}
function openLevelUp() {
  G.mode = "levelup";
  choices = upgradeChoices();
  if (!choices.length) {
    G.pendingLevels = 0;
    G.mode = "play";
    return;
  }
  showLevelUp(G.level - G.pendingLevels + 1, choices, G.taken, pickUpgrade);
}
function pickUpgrade(u) {
  sfx.click();
  takeUpgrade(u);
  if (G.pendingLevels > 0) openLevelUp();
  else {
    G.mode = "play";
    show(null);
  }
}
function gameOver() {
  G.mode = "over";
  const best = loadBest(), isBest = G.score > best.score;
  if (isBest) saveBest({ score: G.score, wave: G.wave.n });
  showOver({ wave: G.wave.n, level: G.level, kills: G.kills, time: G.time, score: G.score }, isBest, start, toTitle);
}

// keys for the menus
function menuKeys() {
  const scr = document.body.dataset.screen;
  if (tappedKey("KeyM")) toggleMute();
  if (scr === "title" && tappedKey("Enter")) start();
  else if (scr === "play" && (tappedKey("Escape", "KeyP") || input.pauseTap)) pause();
  else if (scr === "pause" && (tappedKey("Escape", "KeyP", "Enter") || input.pauseTap)) resume();
  else if (scr === "level") {
    for (let i = 0; i < 3; i++) if (tappedKey("Digit" + (i + 1)) && choices[i]) pickUpgrade(choices[i]);
  } else if (scr === "over" && tappedKey("Enter")) start();
}
addEventListener("blur", () => G.mode === "play" && pause());
document.addEventListener("visibilitychange", () => document.hidden && G.mode === "play" && pause());

// Pick a whole number of device pixels per game pixel (so the art stays crisp), then make the view exactly as big
// as the screen at that scale: no black bars on any phone, either way up.
function fit() {
  const dpr = window.devicePixelRatio || 1, portrait = innerHeight > innerWidth;
  const vw = innerWidth, vh = input.touch ? innerHeight : innerHeight - 24;
  // aim for ~180 game px across the short side (~210 on a portrait phone, whose short side is the width)
  const short = portrait ? vw : vh, target = portrait ? 210 : 180;
  const k = Math.max(1, Math.round((short * dpr) / target)), s = k / dpr;
  const w = Math.max(160, Math.min(480, Math.floor(vw / s))), h = Math.max(160, Math.min(400, Math.floor(vh / s)));
  setView(w, h);
  document.body.classList.toggle("portrait", portrait && input.touch);
  canvas.style.width = w * s + "px";
  canvas.style.height = h * s + "px";
}
addEventListener("resize", fit);
addEventListener("orientationchange", () => setTimeout(fit, 150));
fit();

toTitle();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  menuKeys();
  if (G.mode === "play" || G.mode === "title" || G.mode === "dying") update(dt);
  if (G.mode === "play" && G.pendingLevels > 0) openLevelUp();
  if (G.mode === "dying" && G.dyingTimer <= 0) gameOver();
  endFrame();
  const p = G.player, s = G.stats;
  setButtonCooldown("btn-ult", 1 - p.ultCd / s.ultCooldown);
  setButtonCooldown("btn-air", 1 - p.airCd / s.airCooldown);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// for tests and the console
window.__game = { G, input, start, pause, resume, toTitle };
