// Keyboard, mouse and touch, turned into intentions the game reads each frame.
//
// Five skill slots: 0 is the basic attack (fires while held), 1-3 the class skills, 4 the airstrike.
// Touch: a floating stick on the left; on the right a button per slot. Tap a button to cast with auto-aim, or press
// and drag it to aim by hand (direction skills follow the drag, ground skills show their landing spot); letting
// go back on the button cancels. Desktop: WASD, mouse to aim, left button / J basic, Q E R skills, F airstrike,
// T G job skills, 1 2 potions, Space talk/open, I bag, M map, Esc pause.

import { W, H } from "./config.js";

const slot = () => ({ held: false, aim: null, release: null, keyTap: false });
export const input = {
  touch: false,
  keys: new Set(),
  tapped: new Set(),
  stick: { x: 0, y: 0 },
  mouse: { over: false, x: 0, y: 0, down: false },
  slots: Array.from({ length: 7 }, slot),
  potion: { hp: false, mp: false },
  interact: false,
  bag: false,
  pause: false,
  map: false,
  key: (...codes) => codes.some((c) => input.keys.has(c) || input.tapped.has(c)),
  tap: (...codes) => codes.some((c) => input.tapped.has(c)),
};

export function endFrame() {
  input.tapped.clear();
  for (const s of input.slots) {
    s.release = null;
    s.keyTap = false;
  }
  input.potion.hp = input.potion.mp = false;
  input.interact = input.bag = input.pause = input.map = false;
}
export function releaseAll() {
  input.keys.clear();
  input.stick.x = input.stick.y = 0;
  input.mouse.down = false;
  for (const s of input.slots) Object.assign(s, slot());
}

const GAME_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyJ", "KeyQ", "KeyE", "KeyR", "KeyT", "KeyG", "KeyF", "Space", "Enter", "Escape", "KeyP", "KeyM", "KeyI", "Tab", "Digit1", "Digit2", "Digit3"]);
const $ = (id) => document.getElementById(id);

export function initInput({ canvas, onFirstInput, menuOpen }) {
  addEventListener("keydown", (e) => {
    if (GAME_KEYS.has(e.code) && !(e.target instanceof HTMLButtonElement && (e.code === "Space" || e.code === "Enter"))) e.preventDefault();
    onFirstInput();
    if (e.repeat) return;
    input.tapped.add(e.code);
    input.keys.add(e.code);
    if (menuOpen()) return;
    if (e.code === "KeyJ") input.slots[0].held = true;
    const k = { KeyQ: 1, KeyE: 2, KeyR: 3, KeyT: 4, KeyG: 5, KeyF: 6 }[e.code];
    if (k) input.slots[k].keyTap = true;
    if (e.code === "Digit1") input.potion.hp = true;
    if (e.code === "Digit2") input.potion.mp = true;
    if (e.code === "Space" || e.code === "Enter") input.interact = true;
    if (e.code === "KeyI" || e.code === "Tab") input.bag = true;
    if (e.code === "KeyM") input.map = true;
  });
  addEventListener("keyup", (e) => {
    input.keys.delete(e.code);
    if (e.code === "KeyJ") input.slots[0].held = false;
  });
  addEventListener("blur", releaseAll);

  const toGame = (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = ((e.clientX - r.left) / r.width) * W;
    input.mouse.y = ((e.clientY - r.top) / r.height) * H;
  };
  canvas.addEventListener("mousemove", (e) => {
    toGame(e);
    input.mouse.over = true;
  });
  canvas.addEventListener("mouseleave", () => {
    input.mouse.over = false;
    input.mouse.down = false;
  });
  canvas.addEventListener("mousedown", (e) => {
    toGame(e);
    input.mouse.over = true;
    onFirstInput();
    if (e.button === 0) input.mouse.down = true;
    if (e.button === 2) input.slots[6].keyTap = true;
  });
  addEventListener("mouseup", (e) => e.button === 0 && (input.mouse.down = false));
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  const force = new URLSearchParams(location.search).get("touch");
  input.touch = force === "1" || (force !== "0" && (matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0));
  document.body.classList.toggle("touch", input.touch);
  document.addEventListener("pointerdown", onFirstInput);
  if (input.touch) initTouch();
  $("btn-pause").addEventListener("click", () => (input.pause = true));
  $("btn-bag").addEventListener("click", () => (input.bag = true));
}

const STICK_R = 46, DEAD = 0.2, AIM_MIN = 16, AIM_FULL = 72;

function initTouch() {
  const stop = (e) => {
    if (!e.target.closest?.(".scroll")) e.preventDefault();
  };
  document.addEventListener("touchmove", stop, { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  const zone = $("stickzone"), base = $("stick"), knob = $("knob");
  let id = null, ox = 0, oy = 0;
  const move = (e) => {
    const dx = e.clientX - ox, dy = e.clientY - oy, d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / STICK_R);
    knob.style.transform = `translate(${(dx / d) * Math.min(d, STICK_R)}px, ${(dy / d) * Math.min(d, STICK_R)}px)`;
    input.stick.x = m < DEAD ? 0 : (dx / d) * m;
    input.stick.y = m < DEAD ? 0 : (dy / d) * m;
  };
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    input.stick.x = input.stick.y = 0;
    base.classList.remove("on");
    base.style.left = base.style.top = "";
    knob.style.transform = "";
  };
  zone.addEventListener("pointerdown", (e) => {
    if (id !== null) return;
    id = e.pointerId;
    zone.setPointerCapture(id);
    ox = e.clientX;
    oy = e.clientY;
    base.style.left = ox + "px";
    base.style.top = oy + "px";
    base.classList.add("on");
    move(e);
  });
  zone.addEventListener("pointermove", (e) => e.pointerId === id && move(e));
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) zone.addEventListener(t, end);

  for (let i = 0; i < 7; i++) aimButton($("btn-s" + i), input.slots[i], i === 0);
  $("btn-hp").addEventListener("pointerdown", () => (input.potion.hp = true));
  $("btn-mp").addEventListener("pointerdown", () => (input.potion.mp = true));
  $("btn-act").addEventListener("pointerdown", () => (input.interact = true));
}

// A button you can tap or drag. While dragged past AIM_MIN px, slot.aim is { x, y, k }: a unit direction and how
// far (0..1 of AIM_FULL px). On letting go, slot.release is that aim, "auto" for a tap, or null for a cancel.
function aimButton(el, s, holdFires) {
  let id = null, ox = 0, oy = 0, aimed = false;
  const dot = el.querySelector(".aimdot");
  el.addEventListener("pointerdown", (e) => {
    if (id !== null || el.classList.contains("off")) return;
    id = e.pointerId;
    el.setPointerCapture(id);
    const r = el.getBoundingClientRect();
    ox = r.left + r.width / 2;
    oy = r.top + r.height / 2;
    aimed = false;
    s.aim = null;
    if (holdFires) s.held = true;
    el.classList.add("down");
  });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - ox, dy = e.clientY - oy, d = Math.hypot(dx, dy);
    if (d < AIM_MIN) {
      s.aim = null;
      el.classList.remove("aiming");
      if (dot) dot.style.transform = "";
      return;
    }
    aimed = true;
    s.aim = { x: dx / d, y: dy / d, k: Math.min(1, d / AIM_FULL) };
    el.classList.add("aiming");
    if (dot) dot.style.transform = `translate(${s.aim.x * Math.min(d, 40)}px, ${s.aim.y * Math.min(d, 40)}px)`;
  });
  const fin = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    el.classList.remove("down", "aiming");
    if (dot) dot.style.transform = "";
    if (holdFires) s.held = false;
    else s.release = s.aim ? s.aim : aimed ? null : "auto";
    s.aim = null;
  };
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(t, fin);
}
