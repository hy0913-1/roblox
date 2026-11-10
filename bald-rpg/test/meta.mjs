const ids = process.argv.slice(2);
for (const id of ids) {
  const m = await import(`../vendor/pixelfx/fx/${id}.js`);
  const { name, size, origin, duration, loop, options, actor } = m.meta;
  console.log(id, JSON.stringify({ size, origin, duration, loop, actor, act: !!m.act, kind: m.create ? 'sim' : 'pure', options: Object.fromEntries(Object.entries(options || {}).map(([k, v]) => [k, Array.isArray(v) ? `[${v.length}]` : v])) }));
}
