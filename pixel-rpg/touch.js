// Touch controls: a floating stick on the left half of the screen, a bolt button (hold to keep firing) and an
// ultimate button with a cooldown ring on the right. Pointer events, so several fingers work at once.
// Add ?touch=1 to the URL to force them on a desktop, ?touch=0 to force them off.

export const touch = { enabled: false, sx: 0, sy: 0, bolt: false };

const RADIUS = 46, DEADZONE = 0.2;
const $ = (id) => document.getElementById(id);

export function initTouch({ onUlt }) {
  const force = new URLSearchParams(location.search).get("touch");
  touch.enabled = force === "1" || (force !== "0" && (matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0));
  document.body.classList.toggle("touch", touch.enabled);
  if (!touch.enabled) return;

  // no scrolling, pinch-zoom, text selection or context menu while playing
  const stop = (e) => e.preventDefault();
  document.addEventListener("touchmove", stop, { passive: false });
  document.addEventListener("gesturestart", stop);
  document.addEventListener("contextmenu", stop);

  const zone = $("stickzone"), base = $("stick"), knob = $("knob"), bolt = $("btn-bolt"), ult = $("btn-ult");

  let stickId = null, ox = 0, oy = 0;
  const move = (e) => {
    const dx = e.clientX - ox, dy = e.clientY - oy, d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / RADIUS);
    knob.style.transform = `translate(${(dx / d) * Math.min(d, RADIUS)}px, ${(dy / d) * Math.min(d, RADIUS)}px)`;
    touch.sx = m < DEADZONE ? 0 : (dx / d) * m;
    touch.sy = m < DEADZONE ? 0 : (dy / d) * m;
  };
  const endStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    touch.sx = touch.sy = 0;
    base.classList.remove("on");
    base.style.left = base.style.top = "";
    knob.style.transform = "";
  };
  zone.addEventListener("pointerdown", (e) => {
    if (stickId !== null) return;
    stickId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    ox = e.clientX;
    oy = e.clientY;
    base.style.left = ox + "px";
    base.style.top = oy + "px";
    base.classList.add("on");
    move(e);
  });
  zone.addEventListener("pointermove", (e) => e.pointerId === stickId && move(e));
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) zone.addEventListener(type, endStick);

  // bolt: held = firing
  let boltId = null;
  bolt.addEventListener("pointerdown", (e) => {
    boltId = e.pointerId;
    bolt.setPointerCapture(e.pointerId);
    touch.bolt = true;
    bolt.classList.add("down");
  });
  const endBolt = (e) => {
    if (e.pointerId !== boltId) return;
    boltId = null;
    touch.bolt = false;
    bolt.classList.remove("down");
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) bolt.addEventListener(type, endBolt);

  // ultimate: a tap
  ult.addEventListener("pointerdown", () => {
    ult.classList.add("down");
    onUlt();
  });
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) ult.addEventListener(type, () => ult.classList.remove("down"));

  // letting go of everything when the page goes away stops a stuck stick or a stuck trigger
  addEventListener("blur", () => {
    touch.sx = touch.sy = 0;
    touch.bolt = false;
  });
}

let lastRing = -1, lastReady = null;
// ratio: 0 just cast .. 1 ready
export function setUltButton(ratio, ready) {
  if (!touch.enabled) return;
  const deg = Math.round(ratio * 120) * 3;
  if (deg !== lastRing) {
    lastRing = deg;
    $("btn-ult").style.setProperty("--p", deg + "deg");
  }
  if (ready !== lastReady) {
    lastReady = ready;
    $("btn-ult").classList.toggle("ready", ready);
  }
}
