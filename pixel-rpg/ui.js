// Menus and the HTML parts of the HUD: title, class choice, dialogue (with job advancement), bag & equipment &
// quests, shop, the blacksmith, the bounty board, the wandering merchant, pause, death, ending, and the live bits.

import { CLASSES, SKILLS, RARITY, STAT_NAME, PCT_STATS, POTIONS, KEY_ITEMS, QUESTS, NPCS, SHOP, BAG_SIZE, xpForLevel, SLOTS, ENHANCE, ENEMIES, GEAR } from "./config.js";
import { G, acceptQuest, completeQuest, questProgress, equipItem, unequip, makeItem, giveItem, toast, saveGame, hasSave, usePotion, itemName, itemStats, enhance, claimBounty, advanceJob, jobTitle, rollItem } from "./game.js";
import { slotSkill, slotPreview, SLOT_COUNT } from "./skills.js";
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
const SCREENS = ["title", "class", "dialog", "bag", "shop", "smith", "pause", "dead", "ending"];
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
const fmt = (k, v) => `${STAT_NAME[k]} ${v > 0 ? "+" : ""}${PCT_STATS.has(k) ? Math.round(v * 1000) / 10 + "%" : v}`;
const statLine = (it) => Object.entries(itemStats(it)).map(([k, v]) => fmt(k, v)).join(" · ");
const nameHtml = (it) => `<b style="color:${RARITY[it.rarity].color}">${esc(itemName(it))}</b>`;

// ---- title & class -----------------------------------------------------------------------------------
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
    const br = Object.values(c.branches).map((x) => `${x.name[0]}→${x.name[1]}`).join(" / ");
    b.innerHTML = `<img alt="" src="${heroPortrait(id)}"><span class="cc-name">${c.name}</span><span class="cc-desc">${c.desc}</span>
      <span class="cc-stats">HP ${c.base.maxHp} · MP ${c.base.maxMp} · 공격 ${c.base.atk} · 방어 ${c.base.def}</span>
      <span class="cc-skills">${c.skills.map((s) => `<i>${SKILLS[s].name}</i>`).join("")}</span><span class="cc-title">전직: ${br}</span>`;
    b.onclick = () => (sfx.click(), onPick(id));
    list.append(b);
  }
  show("class");
}

// ---- dialogue ----------------------------------------------------------------------------------------
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
  }, 26);
  $("ov-dialog").onpointerdown = (e) => !e.target.closest("button") && finish();
  for (const [label, fn, primary] of buttons) {
    const b = el("button", primary ? "big-btn small" : "ghost-btn", esc(label));
    b.onclick = () => (sfx.click(), fn());
    row.append(b);
  }
  show("dialog");
  setTimeout(() => row.querySelector("button")?.focus(), 0);
}
const close = () => show(null);

export function talkTo(npcId, cb) {
  if (npcId === "board") return bountyBoard();
  if (npcId === "wanderer") return openShop("wanderer");
  const n = NPCS[npcId], face = NPC_ART[npcId][0], lv = G.player.lv;
  const mine = Object.keys(QUESTS).filter((id) => QUESTS[id].giver === npcId && G.quests[id]);
  const ready = mine.find((id) => G.quests[id].state === "ready");
  const avail = mine.find((id) => G.quests[id].state === "available" && (QUESTS[id].minLevel ?? 0) <= lv);
  const active = mine.find((id) => G.quests[id].state === "active");
  const extra = n.shop ? [["상점 열기", () => openShop("merchant"), false]] : n.smith ? [["장비 강화", () => openSmith(), false]] : [];
  if (ready) {
    return say(n.name, face, QUESTS[ready].done, [
      ["보상 받기", () => {
        const next = completeQuest(ready);
        if (next === "ending") cb.onEnding();
        else if (next === "job2") chooseBranch(face);
        else talkTo(npcId, cb);
      }, true],
    ]);
  }
  if (avail) return say(n.name, face, QUESTS[avail].offer, [["수락", () => (acceptQuest(avail), close()), true], ["나중에", close], ...extra]);
  if (active) return say(n.name, face, `${QUESTS[active].progress} (${questProgress(active)}/${QUESTS[active].count})`, [["알겠어요", close, true], ...extra]);
  const greet = npcId === "jobmaster" && G.job.rank > 1 ? `${jobTitle()}여, 수련을 게을리하지 마라.` : n.greet;
  say(n.name, face, greet, [["닫기", close, !extra.length], ...extra.map((x) => [x[0], x[1], true])]);
}
// the 2nd job: two paths, chosen once
function chooseBranch(face) {
  const c = CLASSES[G.cls];
  const text = Object.values(c.branches).map((b) => `${b.name[0]}: ${b.desc}`).join("\n");
  say(NPCS.jobmaster.name, face, `어느 길을 걷겠느냐?\n${text}`, Object.entries(c.branches).map(([id, b]) => [`${b.name[0]}`, () => (advanceJob(id), close()), true]));
}
export function readSign(o) {
  say("표지판", SPRITES.heart, o.text, [["닫기", close, true]]);
}
function bountyBoard() {
  const b = G.bounty, name = ENEMIES[b.target].name, region = { forest: "숲", highlands: "고원", volcano: "화산", icecave: "얼음 동굴", tower: "마왕의 탑" }[b.region];
  const done = b.n >= b.count;
  say(NPCS.board.name, NPC_ART.board[0], `현상수배: ${region}의 ${name} ${b.count}마리 (${b.n}/${b.count})\n보상: ${b.gold} 골드, 경험치 ${b.xp}${done ? "\n완료! 보상을 받으세요." : ""}`, done ? [["보상 받기", () => (claimBounty(), bountyBoard()), true], ["닫기", close]] : [["닫기", close, true]]);
}

// ---- bag ---------------------------------------------------------------------------------------------
let bagTab = "bag", selected = null;
export function openBag(tab = bagTab) {
  bagTab = tab;
  renderBag();
  show("bag");
}
function itemCell(it, onClick, sel) {
  const b = el("button", "cell" + (sel ? " sel" : ""));
  b.style.setProperty("--r", RARITY[it.rarity].color);
  b.innerHTML = `<img alt="" src="${iconUrl(it.icon)}">${it.plus ? `<em>+${it.plus}</em>` : ""}`;
  b.title = itemName(it);
  b.onclick = onClick;
  return b;
}
function renderBag() {
  for (const t of ["bag", "quests"]) $("tab-" + t).classList.toggle("on", bagTab === t);
  $("bag-body").hidden = bagTab !== "bag";
  $("quest-body").hidden = bagTab !== "quests";
  const s = G.stats, p = G.player;
  $("hero-face").src = heroPortrait(G.cls);
  $("hero-name").textContent = `${jobTitle()} · Lv ${p.lv}`;
  $("hero-stats").innerHTML = [
    ["HP", `${Math.ceil(p.hp)}/${s.maxHp}`], ["MP", `${Math.ceil(p.mp)}/${s.maxMp}`], ["공격", s.atk], ["방어", s.def], ["치명타", Math.round(s.crit * 100) + "%"], ["흡혈", Math.round(s.lifesteal * 1000) / 10 + "%"],
    ["경험치", `${p.xp}/${xpForLevel(p.lv)}`], ["골드", p.gold],
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
  const eq = $("equip-slots");
  eq.replaceChildren();
  for (const [slot, label] of SLOTS) {
    const it = G.equip[slot], row = el("div", "eq");
    row.append(el("span", "eq-label", label));
    if (it) {
      row.append(itemCell(it, () => ((selected = { from: "equip", slot }), renderBag()), selected?.slot === slot));
      row.append(el("span", "eq-name", `${nameHtml(it)}<small>${statLine(it)}</small>`));
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
  for (const k of Object.keys(POTIONS)) {
    if (!G.potions[k]) continue;
    const b = el("button", "cons", `<img alt="" src="${iconUrl(POTIONS[k].icon)}"><span>${POTIONS[k].name}<b>×${G.potions[k]}</b></span>`);
    b.title = POTIONS[k].desc;
    b.onclick = () => {
      usePotion(k);
      if (k === "scroll") show(null);
      else renderBag();
    };
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
  box.append(el("p", "d-name", `${nameHtml(it)} <small>${r.name}${it.unique ? " · 고유" : ""}${it.cls ? " · " + CLASSES[it.cls].name + " 전용" : ""}</small>`));
  box.append(el("p", "d-stats", statLine(it)));
  if (selected.from === "bag") {
    const cur = G.equip[it.slot];
    if (cur) {
      const a = itemStats(it), b = itemStats(cur), diff = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const d = +((a[k] ?? 0) - (b[k] ?? 0)).toFixed(3);
        if (d) diff[k] = d;
      }
      box.append(el("p", "d-cmp", Object.keys(diff).length ? "지금 장비보다: " + Object.entries(diff).map(([k, v]) => `<span class="${v > 0 ? "up" : "down"}">${fmt(k, v)}</span>`).join(" ") : "지금 장비와 같아요"));
    }
    const row = el("div", "row");
    const eqb = el("button", "big-btn small", "장착");
    eqb.onclick = () => (equipItem(it.id), (selected = null), renderBag());
    const drop = el("button", "ghost-btn", "버리기");
    drop.onclick = () => ((G.bag = G.bag.filter((x) => x.id !== it.id)), (selected = null), renderBag());
    row.append(eqb, drop);
    box.append(row);
  } else if (it.slot !== "weapon") {
    const b = el("button", "ghost-btn", "해제");
    b.onclick = () => (unequip(it.slot), (selected = null), renderBag());
    box.append(b);
  }
}
function renderQuests(box) {
  box.replaceChildren();
  const order = { ready: 0, active: 1, available: 2, complete: 3 };
  const ids = Object.keys(G.quests).filter((id) => (QUESTS[id].minLevel ?? 0) <= G.player.lv || G.quests[id].state !== "available").sort((a, b) => order[G.quests[a].state] - order[G.quests[b].state] || (QUESTS[b].main ? 1 : 0) - (QUESTS[a].main ? 1 : 0));
  for (const id of ids) {
    const q = QUESTS[id], st = G.quests[id].state;
    const label = { ready: "보고하기", active: "진행 중", available: "받을 수 있음", complete: "완료" }[st];
    const prog = st === "active" || st === "ready" ? ` ${questProgress(id)}/${q.count}` : "";
    box.append(el("div", "quest " + st, `<span class="q-tag">${q.job ? "전직" : q.main ? "메인" : "서브"}</span><div><b>${q.name}</b><small>${NPCS[q.giver].name} · ${label}${prog}</small></div>`));
  }
  const b = G.bounty;
  if (b) box.append(el("div", "quest " + (b.n >= b.count ? "ready" : "active"), `<span class="q-tag">현상</span><div><b>${ENEMIES[b.target].name} ${b.count}마리</b><small>현상수배 게시판 · ${b.n}/${b.count}</small></div>`));
}

// ---- shops -------------------------------------------------------------------------------------------
let shopTab = "buy", shopKind = "merchant";
function openShop(kind) {
  shopKind = kind;
  shopTab = "buy";
  renderShop();
  show("shop");
}
function renderShop() {
  for (const t of ["buy", "sell"]) $("shop-" + t).classList.toggle("on", shopTab === t);
  $("shop-title").textContent = shopKind === "wanderer" ? NPCS.wanderer.name : NPCS.merchant.name;
  $("shop-gold").textContent = `${G.player.gold} 골드`;
  const list = $("shop-list"), lv = G.player.lv;
  list.replaceChildren();
  const row = (icon, name, sub, price, label, fn, color) => {
    const r = el("div", "shop-row");
    r.innerHTML = `<img alt="" src="${iconUrl(icon)}"><div><b style="color:${color ?? "inherit"}">${esc(name)}</b><small>${sub}</small></div>`;
    const b = el("button", "big-btn small", `${label} ${price}G`);
    b.onclick = fn;
    r.append(b);
    list.append(r);
  };
  if (shopTab === "buy" && shopKind === "wanderer") {
    if (!G.wanderer) return list.append(el("p", "hint", "상인이 떠났어요"));
    for (const s of G.wanderer.stock) if (!s.sold) row(s.item.icon, itemName(s.item), statLine(s.item), s.price, "구매", () => buy(s.price, () => giveItem(s.item) && (s.sold = true)), RARITY[s.item.rarity].color);
    for (const k of ["elixir", "hp2", "mp2"]) row(POTIONS[k].icon, POTIONS[k].name, `${POTIONS[k].desc} · 보유 ${G.potions[k]}`, Math.round(POTIONS[k].price * 0.8), "구매", () => buy(Math.round(POTIONS[k].price * 0.8), () => G.potions[k]++));
  } else if (shopTab === "buy") {
    for (const s of SHOP) {
      if ((s.minLv ?? 0) > lv) continue;
      if (s.kind === "potion") {
        const pt = POTIONS[s.id];
        row(pt.icon, pt.name, `${pt.desc} · 보유 ${G.potions[s.id]}`, pt.price, "구매", () => buy(pt.price, () => G.potions[s.id]++));
      } else {
        const b = GEAR.find((g) => g.tier === s.tier && g.slot === s.slot && (!g.cls || g.cls === G.cls));
        if (!b) continue;
        const it = makeItem(b.base, s.rarity), price = Math.round(it.value * 1.3);
        row(it.icon, itemName(it), statLine(it), price, "구매", () => buy(price, () => giveItem(makeItem(b.base, s.rarity))), RARITY[it.rarity].color);
      }
    }
  } else {
    if (!G.bag.length) list.append(el("p", "hint", "팔 수 있는 장비가 없어요"));
    for (const it of G.bag) row(it.icon, itemName(it), statLine(it), Math.round(it.value / 2), "판매", () => sell(it), RARITY[it.rarity].color);
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

// ---- the blacksmith ----------------------------------------------------------------------------------
let smithSel = null;
function openSmith() {
  smithSel = null;
  renderSmith();
  show("smith");
}
function renderSmith() {
  $("smith-gold").textContent = `${G.player.gold} 골드`;
  const list = $("smith-list"), all = [...Object.values(G.equip).filter(Boolean), ...G.bag];
  list.replaceChildren();
  for (const it of all) list.append(itemCell(it, () => ((smithSel = it.id), renderSmith()), smithSel === it.id));
  const box = $("smith-detail"), it = all.find((x) => x.id === smithSel);
  box.replaceChildren();
  if (!it) return void box.append(el("p", "hint", "강화할 장비를 고르세요. 실패해도 장비는 부서지지 않아요."));
  box.append(el("p", "d-name", nameHtml(it)));
  box.append(el("p", "d-stats", statLine(it)));
  if (it.plus >= ENHANCE.max) return void box.append(el("p", "hint", "최대 강화예요!"));
  const rate = Math.round(ENHANCE.rate(it.plus) * 100), cost = ENHANCE.cost(it);
  box.append(el("p", "d-cmp", `+${it.plus} → +${it.plus + 1} · 성공률 <b>${rate}%</b> · 비용 <b>${cost}G</b> · 능력치 +8%`));
  const b = el("button", "big-btn small", "강화하기");
  b.onclick = () => {
    const r = enhance(it);
    if (r === "gold") toast("골드가 부족해요", "#ff8a6a");
    else if (r === "ok") toast(`강화 성공! +${it.plus}`, "#ffd84a");
    else if (r === "fail") toast("강화 실패… 장비는 무사해요", "#ff8a6a");
    renderSmith();
  };
  box.append(b);
}

export function initMenus({ onResume, onTitle, onRespawn, onMute, isMuted, onMusic, musicOn, onContinueAfterEnding }) {
  $("tab-bag").onclick = () => openBag("bag");
  $("tab-quests").onclick = () => openBag("quests");
  $("bag-close").onclick = () => (saveGame(), show(null));
  $("shop-buy").onclick = () => ((shopTab = "buy"), renderShop());
  $("shop-sell").onclick = () => ((shopTab = "sell"), renderShop());
  $("shop-close").onclick = () => (saveGame(), show(null));
  $("smith-close").onclick = () => (saveGame(), show(null));
  $("btn-resume").onclick = onResume;
  $("btn-quit").onclick = onTitle;
  const labels = () => {
    $("btn-mute").textContent = isMuted() ? "효과음 켜기" : "효과음 끄기";
    $("btn-music").textContent = musicOn() ? "음악 끄기" : "음악 켜기";
  };
  $("btn-mute").onclick = () => (onMute(), labels());
  $("btn-music").onclick = () => (onMusic(), labels());
  labels();
  $("btn-respawn").onclick = onRespawn;
  $("btn-ending-continue").onclick = onContinueAfterEnding;
}
export const showPause = () => show("pause");
export function showEnding() {
  $("ending-stats").textContent = `${jobTitle()} · Lv ${G.player.lv} · ${G.kills}마리 처치 · ${Math.floor(G.time / 60)}분 플레이`;
  show("ending");
}

// ---- live HUD ----------------------------------------------------------------------------------------
const cache = {};
const setText = (id, v) => cache[id] !== v && ((cache[id] = v), ($(id).textContent = v));
const KEYS = ["J", "Q", "E", "R", "T", "G", "F"];
export function updateHud(target) {
  if (!G.cls) return;
  const p = G.player, safe = G.scene.safe && !G.raid;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const id = slotSkill(i), b = $("btn-s" + i), pv = id ? null : slotPreview(i);
    const sk = id ? SKILLS[id] : null;
    const ratio = id ? 1 - Math.min(1, (p.cds[id] ?? 0) / sk.cd) : 0;
    const key = `${id}|${Math.round(ratio * 40)}|${id && p.mp >= sk.mp}|${safe}`;
    if (cache["s" + i] === key) continue;
    cache["s" + i] = key;
    b.classList.toggle("off", !id || !!safe);
    b.classList.toggle("hide", !id && !pv);
    b.classList.toggle("nomp", !!id && p.mp < sk.mp);
    b.classList.toggle("ready", !!id && ratio >= 1);
    b.style.setProperty("--p", Math.round(ratio * 360) + "deg");
    b.querySelector(".nm").textContent = sk ? sk.name : pv ? pv.name : "";
    b.querySelector(".kk").textContent = id ? (input.touch ? (sk.mp ? `MP ${sk.mp}` : "") : KEYS[i] + (sk.mp ? ` · ${sk.mp}` : "")) : pv ? `Lv ${pv.level}` : "";
  }
  setText("hp-count", "×" + (G.potions.hp + G.potions.hp2));
  setText("mp-count", "×" + (G.potions.mp + G.potions.mp2));
  const act = $("btn-act"), prompt = $("prompt");
  const label = target ? { npc: target.ref.object ? "보기" : "대화", chest: "열기", sign: "읽기" }[target.kind] : null;
  const who = target?.kind === "npc" ? NPCS[target.ref.id].name : target?.kind === "chest" ? "상자" : target?.kind === "sign" ? "표지판" : "";
  setText("act-label", label ?? "");
  act.classList.toggle("hide", !label);
  setText("prompt", label ? (input.touch ? who : `Space · ${label}: ${who}`) : "");
  prompt.hidden = !label;
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
  const bn = $("banner");
  if (G.banner && G.banner.t < 2.6) {
    setText("banner", G.banner.name);
    bn.style.opacity = G.banner.t < 0.3 ? G.banner.t / 0.3 : G.banner.t > 2 ? (2.6 - G.banner.t) / 0.6 : 1;
    bn.hidden = false;
  } else bn.hidden = true;
  const qs = Object.keys(G.quests).filter((id) => ["active", "ready"].includes(G.quests[id].state)).sort((a, b) => (QUESTS[b].main ? 1 : 0) - (QUESTS[a].main ? 1 : 0)).slice(0, 3);
  let lines = qs.map((id) => { const q = QUESTS[id], st = G.quests[id].state; return `<div class="${st}"><b>${q.main ? "★ " : ""}${q.name}</b> <span>${st === "ready" ? "보고하기" : questProgress(id) + "/" + q.count}</span></div>`; }).join("");
  if (G.bounty && G.bounty.n > 0) lines += `<div class="${G.bounty.n >= G.bounty.count ? "ready" : "active"}"><b>현상: ${ENEMIES[G.bounty.target].name}</b> <span>${G.bounty.n}/${G.bounty.count}</span></div>`;
  if (G.raid) lines = `<div class="ready"><b>마을 습격!</b> <span>${G.raid.queue.length + G.enemies.filter((e) => e.raid).length}</span></div>` + lines;
  if (cache.tracker !== lines) ((cache.tracker = lines), ($("tracker").innerHTML = lines));
  const bossName = G.boss?.aggro ? ENEMIES[G.boss.type].name : "";
  setText("bossname", bossName);
  $("bossname").hidden = !bossName;
  if (bossName) {
    const r = $("game").getBoundingClientRect();
    $("bossname").style.top = r.top + (r.height / G.viewH) * 44 - 18 + "px";
  }
}
