// Keyboard, mouse and touch, turned into one set of intentions the game reads each frame.
//
// Touch: a floating stick on the left half; on the right, skill buttons you can either tap (auto-aim) or press and
// drag (aim by hand, like a MOBA). BOLT fires while held, toward the drag if you drag. AIR shows its target on the
// ground while you drag and calls the strike when you let go; letting go back on the button cancels. ULT is a tap.
// Mouse: left button fires at the cursor, right click calls the airstrike at the cursor.

import { W, H } from "./config.js";

export const input = {
  touch: false,
  keys: new Set(),
  tapped: new Set(),
  stick: { x: 0, y: 0 },
  mouse: { over: false, x: 0, y: 0, down: false, rightTap: false, moved: 0 },
  bolt: { held: false, aim: null }, // aim: unit vector while dragging, else null (auto)
  air: { aim: null, release: null }, // aim: { x, y, k } while dragging; release: "auto" | { x, y, k } on the frame it's let go
  ultTap: false,
  pauseTap: false,
  any: false, // anything pressed this frame (menus, audio unlock)
};

export const down = (...codes) => codes.some((c) => input.keys.has(c) || input.tapped.has(c));
export const tappedKey = (...codes) => codes.some((c) => input.tapped.has(c));

export function endFrame() {
  input.tapped.clear();
  input.mouse.rightTap = false;
  input.air.release = null;
  input.ultTap = false;
  input.pauseTap = false;
  input.any = false;
}

const GAME_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyJ", "KeyK", "KeyR", "KeyE", "KeyL", "Space", "Enter", "Escape", "KeyP", "KeyM", "Digit1", "Digit2", "Digit3"]);
const $ = (id) => document.getElementById(id);

export function initInput({ canvas, onFirstInput }) {
  const first = () => {
    input.any = true;
    onFirstInput();
  };
  addEventListener("keydown", (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) input.tapped.add(e.code);
    input.keys.add(e.code);
    first();
  });
  addEventListener("keyup", (e) => input.keys.delete(e.code));
  addEventListener("blur", releaseAll);

  // mouse on the canvas, in game pixels
  const toGame = (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = ((e.clientX - r.left) / r.width) * W;
    input.mouse.y = ((e.clientY - r.top) / r.height) * H;
  };
  canvas.addEventListener("mousemove", (e) => {
    toGame(e);
    input.mouse.over = true;
    input.mouse.moved = performance.now();
  });
  canvas.addEventListener("mouseleave", () => {
    input.mouse.over = false;
    input.mouse.down = false;
  });
  canvas.addEventListener("mousedown", (e) => {
    toGame(e);
    input.mouse.over = true;
    if (e.button === 0) input.mouse.down = true;
    if (e.button === 2) input.mouse.rightTap = true;
    first();
  });
  addEventListener("mouseup", (e) => e.button === 0 && (input.mouse.down = false));
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  const force = new URLSearchParams(location.search).get("touch");
  input.touch = force === "1" || (force !== "0" && (matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0));
  document.body.classList.toggle("touch", input.touch);
  document.addEventListener("pointerdown", first);
  if (input.touch) initTouch();

  $("btn-pause").addEventListener("click", () => (input.pauseTap = true));
}

function releaseAll() {
  input.keys.clear();
  input.stick.x = input.stick.y = 0;
  input.bolt.held = false;
  input.bolt.aim = null;
  input.air.aim = null;
  input.mouse.down = false;
}

const STICK_R = 46, DEAD = 0.2, AIM_MIN = 16, AIM_FULL = 72;

function initTouch() {
  const stop = (e) => e.preventDefault();
  document.addEventListener("touchmove", stop, { passive: false });
  document.addEventListener("gesturestart", stop);
  document.addEventListener("contextmenu", stop);

  // the stick
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

  // BOLT: held fires; dragging aims
  aimButton($("btn-bolt"), {
    start: () => (input.bolt.held = true),
    aim: (v) => (input.bolt.aim = v),
    end: () => {
      input.bolt.held = false;
      input.bolt.aim = null;
    },
  });
  // AIR: drag shows the target, release calls it; a tap auto-targets; letting go on the button after aiming cancels
  aimButton($("btn-air"), {
    aim: (v) => (input.air.aim = v),
    end: (v, aimed) => {
      input.air.aim = null;
      input.air.release = v ? v : aimed ? null : "auto";
    },
  });
  $("btn-ult").addEventListener("pointerdown", () => (input.ultTap = true));
}

// A button you can tap or drag. While dragging past AIM_MIN px, aim(v) gets { x, y, k }: a unit direction and how
// far (0..1 of AIM_FULL px). end(v, aimed) gets the last aim (null if let go near the button) and whether it ever aimed.
function aimButton(el, { start, aim, end }) {
  let id = null, ox = 0, oy = 0, aimed = false, last = null;
  const dot = el.querySelector(".aimdot");
  el.addEventListener("pointerdown", (e) => {
    if (id !== null) return;
    id = e.pointerId;
    el.setPointerCapture(id);
    const r = el.getBoundingClientRect();
    ox = r.left + r.width / 2;
    oy = r.top + r.height / 2;
    aimed = false;
    last = null;
    el.classList.add("down");
    start?.();
  });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - ox, dy = e.clientY - oy, d = Math.hypot(dx, dy);
    if (d < AIM_MIN) {
      last = null;
      aim?.(null);
      el.classList.remove("aiming");
      if (dot) dot.style.transform = "";
      return;
    }
    aimed = true;
    last = { x: dx / d, y: dy / d, k: Math.min(1, d / AIM_FULL) };
    aim?.(last);
    el.classList.add("aiming");
    if (dot) dot.style.transform = `translate(${last.x * Math.min(d, 44)}px, ${last.y * Math.min(d, 44)}px)`;
  });
  const fin = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    el.classList.remove("down", "aiming");
    if (dot) dot.style.transform = "";
    end?.(last, aimed);
  };
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(t, fin);
}

// cooldown rings on the touch buttons: ratio 0 (just used) .. 1 (ready)
const ringCache = new Map();
export function setButtonCooldown(id, ratio) {
  if (!input.touch) return;
  const deg = Math.round(ratio * 120) * 3, ready = ratio >= 1;
  const c = ringCache.get(id);
  if (c && c.deg === deg && c.ready === ready) return;
  ringCache.set(id, { deg, ready });
  const el = $(id);
  el.style.setProperty("--p", deg + "deg");
  el.classList.toggle("ready", ready);
}
