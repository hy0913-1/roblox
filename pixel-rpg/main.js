// Frost Wizard RPG: pick a class, take quests in the village, clear the forest, the Slime Cave and the Old Crypt.

import { setView } from "./config.js";
import { G, newGame, loadGame, saveGame, update, interactable, openChest, respawnInTown, toast } from "./game.js";
import { getScene } from "./world.js";
import { loadAssets } from "./assets.js";
import { initRender, draw, drawMinimap } from "./render.js";
import { input, initInput, endFrame, releaseAll } from "./input.js";
import { show, screen, menuOpen, showTitle, talkTo, readSign, openBag, initMenus, showPause, showEnding, updateHud } from "./ui.js";
import { unlockAudio, setMuted, isMuted, sfx, playMusic, setMusicOn, isMusicOn } from "./audio.js";

const canvas = document.getElementById("game");
initRender(canvas);
initInput({ canvas, onFirstInput: unlockAudio, menuOpen });
try {
  setMuted(localStorage.getItem("frostwizard.muted") === "1");
  setMusicOn(localStorage.getItem("frostwizard.music") !== "0");
} catch {}

// the title screen shows the village behind it
function toTitle() {
  saveGame();
  G.mode = "title";
  G.cls = null;
  Object.assign(G, { scene: getScene("town"), player: { x: 20 * 16 + 8, y: 15 * 16, face: "down", cds: {} }, enemies: [], projectiles: [], fxs: [], pickups: [], texts: [], toasts: [], strikes: [], dashes: [], zones: [], shake: 0, flash: 0, hitstop: 0, time: 0 });
  showTitle({
    onNew: (cls) => {
      newGame(cls);
      show(null);
    },
    onContinue: () => {
      if (loadGame()) {
        show(null);
        toast("이어서 시작합니다", "#9bdcff");
      }
    },
  });
}
function pause() {
  if (screen !== "play" || G.mode !== "play") return;
  saveGame();
  releaseAll();
  showPause();
}
function toggleMute() {
  setMuted(!isMuted());
  try {
    localStorage.setItem("frostwizard.muted", isMuted() ? "1" : "0");
  } catch {}
}
initMenus({
  onResume: () => show(null),
  onTitle: toTitle,
  onRespawn: () => {
    respawnInTown();
    show(null);
  },
  onMute: toggleMute,
  isMuted,
  onMusic: () => {
    setMusicOn(!isMusicOn());
    try {
      localStorage.setItem("frostwizard.music", isMusicOn() ? "1" : "0");
    } catch {}
  },
  musicOn: isMusicOn,
  onContinueAfterEnding: () => show(null),
});

addEventListener("blur", pause);
document.addEventListener("visibilitychange", () => document.hidden && pause());

function fit() {
  const dpr = window.devicePixelRatio || 1, portrait = innerHeight > innerWidth;
  const vw = innerWidth, vh = innerHeight;
  const short = portrait ? vw : vh, target = portrait ? 210 : 190;
  const k = Math.max(1, Math.round((short * dpr) / target)), s = k / dpr;
  const w = Math.max(160, Math.min(480, Math.floor(vw / s))), h = Math.max(160, Math.min(400, Math.floor(vh / s)));
  setView(w, h);
  G.viewH = h;
  document.body.classList.toggle("portrait", portrait);
  canvas.style.width = w * s + "px";
  canvas.style.height = h * s + "px";
}
addEventListener("resize", fit);
addEventListener("orientationchange", () => setTimeout(fit, 150));
fit();

// keys that work in menus
function menuKeys() {
  if (input.tap("Escape")) {
    if (screen === "play") pause();
    else if (["bag", "shop", "smith", "pause", "dialog"].includes(screen)) (saveGame(), show(null));
  }
  if (screen === "play" && input.pause) pause();
  if (screen === "play" && input.bag) openBag();
  else if (screen === "bag" && (input.tap("KeyI") || input.tap("Tab"))) show(null);
  if (screen === "play" && input.map) document.getElementById("minimap").classList.toggle("big");
  if (screen === "title" && input.tap("Enter")) document.getElementById(document.getElementById("btn-continue").hidden ? "btn-new" : "btn-continue").click();
}

toTitle();
loadAssets(); // image art swaps in as soon as it has loaded; until then (or without assets/) the code-drawn art shows
let last = performance.now(), mapT = 0, saveT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  menuKeys();
  const playing = screen === "play" && G.mode === "play";
  if (playing) {
    update(dt, input);
    const target = interactable();
    if (input.interact && target) {
      releaseAll();
      if (target.kind === "npc") talkTo(target.ref.id, { onEnding: showEnding });
      else if (target.kind === "chest") openChest(target.ref);
      else if (target.kind === "sign") readSign(target.ref);
    }
    updateHud(target);
    playMusic(G.boss?.aggro || G.raid ? "boss" : G.scene.id);
    if (G.mode === "dead") {
      releaseAll();
      show("dead");
    }
    saveT += dt;
    if (saveT > 20) (saveT = 0), saveGame();
  } else if (G.mode === "title" || screen === "dialog") {
    // the world keeps breathing behind menus that don't pause it
    for (const e of G.fxs) e.fx.update(dt);
    G.time += dt;
    if (G.cls) updateHud(null);
  }
  endFrame();
  mapT -= dt;
  if (mapT <= 0 && G.cls) {
    mapT = 0.2;
    drawMinimap(document.getElementById("minimap"));
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__game = { G, input, show, newGame, toTitle };
