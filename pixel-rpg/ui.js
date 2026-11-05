// Menus and the HTML parts of the HUD. Korean text needs a real font, so everything with words is HTML:
// title, class choice, dialogue, bag & equipment & quests, shop, pause, death, ending, and the live bits
// (skill bar, interaction prompt, toasts, quest tracker, location banner).

import { CLASSES, SKILLS, RARITY, STAT_NAME, POTIONS, KEY_ITEMS, QUESTS, NPCS, SHOP, BAG_SIZE, xpForLevel } from "./config.js";
import { G, acceptQuest, completeQuest, questProgress, equipItem, unequip, makeItem, giveItem, toast, saveGame, hasSave, drinkPotion } from "./game.js";
import { slotSkill, skillReady } from "./skills.js";
import { input } from "./input.js";
import { iconUrl, portraitUrl, HEROES, NPC_ART } from "./art.js";
import { SPRITES } from "./sprites.js";
import { sfx } from "./audio.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const SCREENS = ["title", "class", "dialog", "bag", "shop", "pause", "dead", "ending"];
export let screen = "title";

export function show(name) {
  screen = name ?? "play";
  for (const s of SCREENS) $("ov-" + s).hidden = s !== name;
  document.body.classList.toggle("playing", !name || name === "dialog");
  document.body.dataset.screen = screen;
  input.mouse.down = false;
}
export const menuOpen = () => screen !== "play";

const heroPortrait = (cls) => portraitUrl(cls === "mage" ? SPRITES.wizard.down[0] : HEROES[cls].down[0]);
const statLine = (stats) => Object.entries(stats).map(([k, v]) => `${STAT_NAME[k]} ${v > 0 ? "+" : ""}${k === "crit" ? Math.round(v * 100) + "%" : v}`).join(" · ");

// ---- title & class ---------------------------------------------------------------------------------
export function showTitle({ onNew, onContinue }) {
  $("btn-continue").hidden = !hasSave();
  $("btn-continue").onclick = onContinue;
  $("btn-new").onclick = () => showClassSelect(onNew);
  show("title");
}
function showClassSelect(onPick) {
  const list = $("class-cards");
  list.replaceChildren();
  for (const [id, c] of Object.entries(CLASSES)) {
    const b = el("button", "class-card");
    b.id = "class-" + id;
    b.style.setProperty("--tag", c.color);
    b.innerHTML = `<img alt="" src="${heroPortrait(id)}"><span class="cc-name">${c.name}</span><span class="cc-title">${c.title}</span><span class="cc-desc">${c.desc}</span>
      <span class="cc-stats">HP ${c.base.maxHp} · MP ${c.base.maxMp} · 공격 ${c.base.atk} · 방어 ${c.base.def}</span>
      <span class="cc-skills">${c.skills.map((s) => `<i>${SKILLS[s].name}<small>Lv${SKILLS[s].level}</small></i>`).join("")}</span>`;
    b.onclick = () => {
      sfx.click();
      onPick(id);
    };
    list.append(b);
  }
  show("class");
}

// ---- dialogue --------------------------------------------------------------------------------------
let typer = null;
function say(name, img, textStr, buttons) {
  $("dlg-name").textContent = name;
  $("dlg-face").src = portraitUrl(img);
  const t = $("dlg-text"), row = $("dlg-buttons");
  row.replaceChildren();
  clearInterval(typer);
  let i = 0;
  t.textContent = "";
  const finish = () => {
    clearInterval(typer);
    t.textContent = textStr;
    row.hidden = false;
  };
  row.hidden = true;
  typer = setInterval(() => {
    i += 2;
    t.textContent = textStr.slice(0, i);
    if (i % 6 === 0) sfx.talk();
    if (i >= textStr.length) finish();
  }, 28);
  $("ov-dialog").onpointerdown = (e) => {
    if (!e.target.closest("button")) finish();
  };
  for (const [label, fn, primary] of buttons) {
    const b = el("button", primary ? "big-btn small" : "ghost-btn", esc(label));
    b.onclick = () => {
      sfx.click();
      fn();
    };
    row.append(b);
  }
  show("dialog");
  setTimeout(() => row.querySelector("button")?.focus(), 0);
}
export function talkTo(npcId, { onEnding }) {
  const n = NPCS[npcId], face = NPC_ART[npcId][0], close = () => show(null);
  const mine = Object.keys(QUESTS).filter((id) => QUESTS[id].giver === npcId && G.quests[id]);
  const ready = mine.find((id) => G.quests[id].state === "ready");
  const avail = mine.find((id) => G.quests[id].state === "available");
  const active = mine.find((id) => G.quests[id].state === "active");
  const extra = n.shop ? [["상점 열기", () => openShop(), false]] : [];
  if (ready) {
    const q = QUESTS[ready];
    return say(n.name, face, q.done, [
      ["보상 받기", () => {
        const ending = completeQuest(ready);
        if (ending) onEnding();
        else talkTo(npcId, { onEnding });
      }, true],
    ]);
  }
  if (avail) {
    const q = QUESTS[avail];
    return say(n.name, face, q.offer, [["수락", () => (acceptQuest(avail), close()), true], ["나중에", close], ...extra]);
  }
  if (active) return say(n.name, face, `${QUESTS[active].progress} (${questProgress(active)}/${QUESTS[active].count})`, [["알겠어요", close, true], ...extra]);
  say(n.name, face, n.greet, [["닫기", close, !n.shop], ...extra.map((x) => [x[0], x[1], true])]);
}
export function readSign(o) {
  say("표지판", SPRITES.heart, o.text, [["닫기", () => show(null), true]]);
}

// ---- bag -------------------------------------------------------------------------------------------
let bagTab = "bag", selected = null;
export function openBag(tab = bagTab) {
  bagTab = tab;
  renderBag();
  show("bag");
}
function itemCell(it, onClick, sel) {
  const b = el("button", "cell" + (sel ? " sel" : ""));
  b.style.setProperty("--r", RARITY[it.rarity].color);
  b.innerHTML = `<img alt="" src="${iconUrl(it.icon)}">`;
  b.title = it.name;
  b.onclick = onClick;
  return b;
}
function renderBag() {
  for (const t of ["bag", "quests"]) $("tab-" + t).classList.toggle("on", bagTab === t);
  $("bag-body").hidden = bagTab !== "bag";
  $("quest-body").hidden = bagTab !== "quests";
  const s = G.stats, p = G.player, c = CLASSES[G.cls];
  $("hero-face").src = heroPortrait(G.cls);
  $("hero-name").textContent = `${c.title} · Lv ${p.lv}`;
  $("hero-stats").innerHTML = [
    ["HP", `${Math.ceil(p.hp)}/${s.maxHp}`], ["MP", `${Math.ceil(p.mp)}/${s.maxMp}`], ["공격", s.atk], ["방어", s.def], ["치명타", Math.round(s.crit * 100) + "%"], ["이동", Math.round(s.speed)],
    ["경험치", `${p.xp}/${xpForLevel(p.lv)}`], ["골드", p.gold],
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
  const eq = $("equip-slots");
  eq.replaceChildren();
  for (const [slot, label] of [["weapon", "무기"], ["armor", "방어구"], ["trinket", "장신구"]]) {
    const it = G.equip[slot], row = el("div", "eq");
    row.append(el("span", "eq-label", label));
    if (it) {
      row.append(itemCell(it, () => ((selected = { from: "equip", slot }), renderBag()), selected?.slot === slot));
      row.append(el("span", "eq-name", `<b style="color:${RARITY[it.rarity].color}">${esc(it.name)}</b><small>${statLine(it.stats)}</small>`));
    } else row.append(el("span", "eq-empty", "비어 있음"));
    eq.append(row);
  }
  const grid = $("bag-grid");
  grid.replaceChildren();
  for (let i = 0; i < BAG_SIZE; i++) {
    const it = G.bag[i];
    grid.append(it ? itemCell(it, () => ((selected = { from: "bag", id: it.id }), renderBag()), selected?.id === it.id) : el("span", "cell empty"));
  }
  const cons = $("consumables");
  cons.replaceChildren();
  for (const k of ["hp", "mp"]) {
    const b = el("button", "cons", `<img alt="" src="${iconUrl(POTIONS[k].icon)}"><span>${POTIONS[k].name}<b>×${G.potions[k]}</b></span>`);
    b.onclick = () => (drinkPotion(k), renderBag());
    cons.append(b);
  }
  for (const k in KEY_ITEMS) if (G.keys[k]) cons.append(el("div", "cons key", `<img alt="" src="${iconUrl(KEY_ITEMS[k].icon)}"><span>${KEY_ITEMS[k].name}<b>×${G.keys[k]}</b></span>`));
  renderDetail();
  renderQuests($("quest-body"));
}
function renderDetail() {
  const box = $("item-detail");
  box.replaceChildren();
  const it = selected?.from === "bag" ? G.bag.find((x) => x.id === selected.id) : selected?.from === "equip" ? G.equip[selected.slot] : null;
  if (!it) return void box.append(el("p", "hint", "아이템을 누르면 자세히 볼 수 있어요"));
  const r = RARITY[it.rarity];
  box.append(el("p", "d-name", `<b style="color:${r.color}">${esc(it.name)}</b> <small>${r.name}${it.cls ? " · " + CLASSES[it.cls].name + " 전용" : ""}</small>`));
  box.append(el("p", "d-stats", statLine(it.stats)));
  if (selected.from === "bag") {
    const cur = G.equip[it.slot];
    if (cur) {
      const diff = {};
      for (const k of new Set([...Object.keys(it.stats), ...Object.keys(cur.stats)])) {
        const d = +((it.stats[k] ?? 0) - (cur.stats[k] ?? 0)).toFixed(3);
        if (d) diff[k] = d;
      }
      box.append(el("p", "d-cmp", Object.keys(diff).length ? "지금 장비보다: " + Object.entries(diff).map(([k, v]) => `<span class="${v > 0 ? "up" : "down"}">${STAT_NAME[k]} ${v > 0 ? "+" : ""}${k === "crit" ? Math.round(v * 100) + "%" : v}</span>`).join(" ") : "지금 장비와 같아요"));
    }
    const row = el("div", "row");
    const eqb = el("button", "big-btn small", "장착");
    eqb.onclick = () => {
      equipItem(it.id);
      selected = null;
      renderBag();
    };
    const drop = el("button", "ghost-btn", "버리기");
    drop.onclick = () => {
      G.bag = G.bag.filter((x) => x.id !== it.id);
      selected = null;
      renderBag();
    };
    row.append(eqb, drop);
    box.append(row);
  } else if (it.slot !== "weapon") {
    const b = el("button", "ghost-btn", "해제");
    b.onclick = () => {
      unequip(it.slot);
      selected = null;
      renderBag();
    };
    box.append(b);
  }
}
function renderQuests(box) {
  box.replaceChildren();
  const order = { ready: 0, active: 1, available: 2, complete: 3 };
  const ids = Object.keys(G.quests).sort((a, b) => order[G.quests[a].state] - order[G.quests[b].state] || (QUESTS[b].main ? 1 : 0) - (QUESTS[a].main ? 1 : 0));
  for (const id of ids) {
    const q = QUESTS[id], st = G.quests[id].state;
    const label = { ready: "보고하기", active: "진행 중", available: "받을 수 있음", complete: "완료" }[st];
    const prog = st === "active" || st === "ready" ? ` ${questProgress(id)}/${q.count}` : "";
    box.append(el("div", "quest " + st, `<span class="q-tag">${q.main ? "메인" : "서브"}</span><div><b>${q.name}</b><small>${NPCS[q.giver].name} · ${label}${prog}</small></div>`));
  }
}

// ---- shop ------------------------------------------------------------------------------------------
let shopTab = "buy";
function openShop() {
  shopTab = "buy";
  renderShop();
  show("shop");
}
function renderShop() {
  for (const t of ["buy", "sell"]) $("shop-" + t).classList.toggle("on", shopTab === t);
  $("shop-gold").textContent = `${G.player.gold} 골드`;
  const list = $("shop-list");
  list.replaceChildren();
  const row = (icon, name, sub, price, label, fn, color) => {
    const r = el("div", "shop-row");
    r.innerHTML = `<img alt="" src="${iconUrl(icon)}"><div><b style="color:${color ?? "inherit"}">${esc(name)}</b><small>${sub}</small></div>`;
    const b = el("button", "big-btn small", `${label} ${price}G`);
    b.onclick = fn;
    r.append(b);
    list.append(r);
  };
  if (shopTab === "buy") {
    for (const s of SHOP) {
      if (s.kind === "potion") {
        const pt = POTIONS[s.id];
        row(pt.icon, pt.name, `${pt.desc} · 보유 ${G.potions[s.id]}`, pt.price, "구매", () => buy(pt.price, () => G.potions[s.id]++));
      } else {
        const it = makeItem(s.base, s.rarity);
        if (it.cls && it.cls !== G.cls) continue;
        row(it.icon, it.name, statLine(it.stats), s.price, "구매", () => buy(s.price, () => giveItem(makeItem(s.base, s.rarity))), RARITY[it.rarity].color);
      }
    }
  } else {
    if (!G.bag.length) list.append(el("p", "hint", "팔 수 있는 장비가 없어요"));
    for (const it of G.bag) row(it.icon, it.name, statLine(it.stats), Math.round(it.value / 2), "판매", () => sell(it), RARITY[it.rarity].color);
  }
}
function buy(price, give) {
  if (G.player.gold < price) return toast("골드가 부족해요", "#ff8a6a");
  if (give() === false) return;
  G.player.gold -= price;
  sfx.coin();
  renderShop();
}
function sell(it) {
  G.bag = G.bag.filter((x) => x.id !== it.id);
  G.player.gold += Math.round(it.value / 2);
  sfx.coin();
  renderShop();
}

export function initMenus({ onResume, onTitle, onRespawn, onMute, isMuted, onContinueAfterEnding }) {
  $("tab-bag").onclick = () => openBag("bag");
  $("tab-quests").onclick = () => openBag("quests");
  $("bag-close").onclick = () => (saveGame(), show(null));
  $("shop-buy").onclick = () => ((shopTab = "buy"), renderShop());
  $("shop-sell").onclick = () => ((shopTab = "sell"), renderShop());
  $("shop-close").onclick = () => (saveGame(), show(null));
  $("btn-resume").onclick = onResume;
  $("btn-quit").onclick = onTitle;
  $("btn-mute").onclick = () => {
    onMute();
    $("btn-mute").textContent = isMuted() ? "소리 켜기" : "소리 끄기";
  };
  $("btn-respawn").onclick = onRespawn;
  $("btn-ending-continue").onclick = onContinueAfterEnding;
}
export function showPause(muted) {
  $("btn-mute").textContent = muted ? "소리 켜기" : "소리 끄기";
  show("pause");
}
export function showEnding() {
  $("ending-stats").textContent = `${CLASSES[G.cls].title} · Lv ${G.player.lv} · ${Math.floor(G.time / 60)}분 플레이`;
  show("ending");
}

// ---- live HUD --------------------------------------------------------------------------------------
const cache = {};
const setText = (id, v) => cache[id] !== v && ((cache[id] = v), ($(id).textContent = v));
const KEYS = ["J", "Q", "E", "R", "F"];
export function updateHud(target) {
  if (!G.cls) return;
  const p = G.player;
  // skill buttons / bar: name, key, cooldown ring, locked or out of mana
  for (let i = 0; i < 5; i++) {
    const id = slotSkill(i), b = $("btn-s" + i), all = CLASSES[G.cls].skills[i];
    const sk = id ? SKILLS[id] : i < 4 ? SKILLS[all] : null;
    const cd = id ? (p.cds[id] ?? 0) / sk.cd : 1, ratio = id ? 1 - Math.min(1, cd) : 0;
    const key = `${id}|${Math.round(ratio * 40)}|${id && p.mp >= sk.mp}|${G.scene.safe}`;
    if (cache["s" + i] === key) continue;
    cache["s" + i] = key;
    b.classList.toggle("off", !id || G.scene.safe);
    b.classList.toggle("hide", i === 4 && !id);
    b.classList.toggle("nomp", !!id && p.mp < sk.mp);
    b.classList.toggle("ready", !!id && ratio >= 1);
    b.style.setProperty("--p", Math.round(ratio * 360) + "deg");
    b.querySelector(".nm").textContent = sk ? sk.name : "";
    b.querySelector(".kk").textContent = id ? (input.touch ? (sk.mp ? `MP ${sk.mp}` : "") : KEYS[i] + (sk.mp ? ` · ${sk.mp}` : "")) : sk ? `Lv ${sk.level}` : "";
  }
  setText("hp-count", "×" + G.potions.hp);
  setText("mp-count", "×" + G.potions.mp);
  // what's in reach
  const act = $("btn-act"), prompt = $("prompt");
  const label = target ? { npc: "대화", chest: "열기", sign: "읽기" }[target.kind] : null;
  const who = target?.kind === "npc" ? NPCS[target.ref.id].name : target?.kind === "chest" ? "상자" : target?.kind === "sign" ? "표지판" : "";
  setText("act-label", label ?? "");
  act.classList.toggle("hide", !label);
  setText("prompt", label ? (input.touch ? `${who}` : `Space · ${label}: ${who}`) : "");
  prompt.hidden = !label;
  // toasts
  const box = $("toasts");
  for (const t of G.toasts) {
    if (!t.el) {
      t.el = el("div", "toast", esc(t.msg));
      t.el.style.color = t.color;
      box.append(t.el);
    }
    t.el.style.opacity = t.t > 2.8 ? Math.max(0, (3.4 - t.t) / 0.6) : 1;
  }
  for (const n of [...box.children]) if (!G.toasts.some((t) => t.el === n)) n.remove();
  while (G.toasts.length > 4) G.toasts.shift();
  // the place you just entered
  const bn = $("banner");
  if (G.banner && G.banner.t < 2.6) {
    setText("banner", G.banner.name);
    bn.style.opacity = G.banner.t < 0.3 ? G.banner.t / 0.3 : G.banner.t > 2 ? (2.6 - G.banner.t) / 0.6 : 1;
    bn.hidden = false;
  } else bn.hidden = true;
  // quest tracker: the active ones
  const lines = Object.keys(G.quests).filter((id) => ["active", "ready"].includes(G.quests[id].state)).sort((a, b) => (QUESTS[b].main ? 1 : 0) - (QUESTS[a].main ? 1 : 0)).slice(0, 3)
    .map((id) => { const q = QUESTS[id], st = G.quests[id].state; return `<div class="${st}"><b>${q.main ? "★ " : ""}${q.name}</b> <span>${st === "ready" ? "보고하기" : questProgress(id) + "/" + q.count}</span></div>`; }).join("");
  if (cache.tracker !== lines) ((cache.tracker = lines), ($("tracker").innerHTML = lines));
  // the boss's name over its bar
  const bossName = G.boss?.aggro ? (G.boss.type === "lich" ? "리치" : "킹 슬라임") : "";
  setText("bossname", bossName);
  $("bossname").hidden = !bossName;
  if (bossName) {
    // sits just above the bar, which is at y 44 in game pixels
    const r = $("game").getBoundingClientRect();
    $("bossname").style.top = r.top + (r.height / G.viewH) * 44 - 18 + "px";
  }
}
