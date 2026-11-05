// Builds dist/frost-wizard.html: the whole game in one file (all modules bundled and inlined), which runs from
// anywhere, including straight off a phone or any static host.  Usage: node build.mjs   (needs npx / esbuild)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
execFileSync("npx", ["--yes", "esbuild@0.25.10", "main.js", "--bundle", "--minify", "--format=iife", "--target=es2020", "--outfile=dist/bundle.js"], { stdio: "inherit" });
const js = readFileSync("dist/bundle.js", "utf8");
if (/<\/script/i.test(js)) throw new Error("bundle contains </script>");
const html = readFileSync("index.html", "utf8").replace('<script type="module" src="./main.js"></script>', () => `<script>\n${js}\n</script>`);
writeFileSync("dist/frost-wizard.html", html);
// the same page without its own <html>/<head>/<body> shell, for hosts that wrap pages themselves
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, "");
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
writeFileSync("dist/frost-wizard.fragment.html", head.trim() + "\n" + body.trim() + "\n");
console.log("dist/frost-wizard.html", html.length, "bytes");
