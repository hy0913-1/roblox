// Plays the whole game with tools/bot.js and prints one line per stage.
//   cd pixel-rpg && node tools/playtest.mjs [classes...] [--branch 1]      (Playwright + Chromium preinstalled)
// It serves the folder itself on a free port.
import { createRequire } from "node:module";
import { spawn, execSync } from "node:child_process";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require(execSync("npm root -g").toString().trim() + "/playwright"));
}
const args = process.argv.slice(2);
const bi = args.indexOf("--branch"), branch = bi >= 0 ? +args.splice(bi, 2)[1] : 0;
const classes = args.length ? args : ["mage", "knight", "ranger", "thief"];
const port = 8800 + Math.floor(Math.random() * 100);
const server = spawn("python3", ["-m", "http.server", String(port)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));

const STAGES = [
  { name: "숲 (Lv5까지)", scene: "forest", done: "G.player.lv >= 5 && G.quests.q1?.state !== 'active'" },
  { name: "슬라임 동굴", scene: "cave", done: "G.flags.kingDead" },
  { name: "고대 묘지", scene: "crypt", done: "G.flags.lichDead" },
  { name: "고원 (오크 족장)", scene: "highlands", done: "G.flags.chiefDead && G.job.rank >= 2", focus: "chief", focusLv: 13 },
  { name: "화산 (드레이크)", scene: "volcano", done: "G.flags.drakeDead" },
  { name: "얼음 동굴 (거인)", scene: "icecave", done: "G.flags.giantDead" },
  { name: "마왕의 탑 (바엘)", scene: "tower", done: "G.flags.demonkingDead", maxMin: 40 },
];

const browser = await chromium.launch();
try {
  for (const cls of classes) {
    const page = await browser.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(`http://localhost:${port}/?touch=1`);
    await page.waitForTimeout(800);
    await page.evaluate(async ([cls, branch]) => (await import("./tools/bot.js")).start(cls, branch), [cls, branch]);
    console.log(`\n== ${cls} (branch ${branch}) ==`);
    for (const s of STAGES) {
      const r = await page.evaluate(async (s) => {
        const bot = await import("./tools/bot.js"), { G } = await import("./game.js");
        const done = new Function("G", "return !!(" + s.done + ")").bind(null, G);
        return bot.stage({ ...s, done });
      }, s);
      console.log(
        `${r.ok ? "OK  " : "FAIL"} ${s.name.padEnd(14)} Lv ${r.lvIn}->${r.lvOut}  ${String(r.min).padStart(5)}분  죽음 ${r.deaths}  귀환 ${r.recalls}  물약 ${r.potions}  보스전 ${r.bossSec ?? "-"}초(HP${r.bossHp} 피격${r.bossHits}회 ${r.bossTaken} 최저${r.bossLow}%)  전직 ${r.job}  공${r.atk} 방${r.def} HP${r.hp}  골드 ${r.gold}  장비 ${r.gear}`
      );
      if (!r.ok) break;
    }
    const ending = await page.evaluate(async () => (await import("./game.js")).G.quests.q7?.state);
    console.log("q7:", ending, errs.length ? "ERRORS: " + errs.slice(0, 5).join(" | ") : "no page errors");
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
