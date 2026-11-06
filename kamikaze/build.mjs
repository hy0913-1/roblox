// Builds dist/kamikaze.html: the whole game in one file (modules bundled and inlined) that opens from anywhere,
// including straight off a phone, plus dist/kamikaze.fragment.html (no <html>/<head>/<body>) for hosts that wrap pages.
// Usage: node build.mjs   (needs npx / esbuild)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
execFileSync("npx", ["--yes", "esbuild@0.25.10", "game.js", "--bundle", "--minify", "--format=iife", "--target=es2020", "--outfile=dist/bundle.js"], { stdio: "inherit" });
const js = readFileSync("dist/bundle.js", "utf8");
if (/<\/script/i.test(js)) throw new Error("bundle contains </script>");
const html = readFileSync("index.html", "utf8").replace('<script type="module" src="./game.js"></script>', () => `<script>\n${js}\n</script>`);
writeFileSync("dist/kamikaze.html", html);
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, "");
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
writeFileSync("dist/kamikaze.fragment.html", head.trim() + "\n" + body.trim() + "\n");
console.log("dist/kamikaze.html", html.length, "bytes");
