// _cmt-diff.cjs — 共表注释四分类对比(一次性探针;值为裁剪后比较,<NULL>=空值跳过)
const fs = require('fs');
function load(f) {
  const m = new Map();
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const i1 = line.indexOf('\t'), i2 = line.indexOf('\t', i1 + 1);
    if (i1 < 0 || i2 < 0) continue;
    const k = line.slice(0, i1).trim() + '\t' + line.slice(i1 + 1, i2).trim();
    const v = line.slice(i2 + 1).trim();
    if (v === '<NULL>') continue;
    if (!m.has(k)) m.set(k, new Set());
    m.get(k).add(v);
  }
  return m;
}
const srv = load(__dirname + '/cmt-srv.tsv');
const loc = load(__dirname + '/cmt-loc.tsv');
const shared = [], diverge = [], srvOnly = [], locOnly = [];
for (const [k, sv] of srv) {
  if (!loc.has(k)) { srvOnly.push([k, [...sv].join(' | '), '']); continue; }
  const lv = loc.get(k);
  const same = [...sv].every(t => lv.has(t)) && [...lv].every(t => sv.has(t));
  if (same) shared.push(k); else diverge.push([k, [...sv].join(' | '), [...lv].join(' | ')]);
}
for (const [k, lv] of loc) if (!srv.has(k)) locOnly.push([k, '', [...lv].join(' | ')]);
const top = (rows, n = 20) => {
  const c = new Map();
  rows.forEach(([k]) => { const t = k.split('\t')[0]; c.set(t, (c.get(t) || 0) + 1); });
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t, n]) => `  ${t}: ${n}`).join('\n');
};
console.log(`共表注释键: 共用一致 ${shared.length} | 两边都有但文案分歧 ${diverge.length} | 服务器独有 ${srvOnly.length} | 本地独有 ${locOnly.length}`);
console.log('--- 服务器独有 Top 表 ---\n' + top(srvOnly));
console.log('--- 文案分歧 Top 表 ---\n' + top(diverge));
console.log('--- 本地独有 Top 表 ---\n' + top(locOnly));
const dump = (name, rows) => fs.writeFileSync(__dirname + '/' + name, rows.map(r => r.join('\t')).join('\n') + '\n');
dump('cmt-srv-only.tsv', srvOnly);
dump('cmt-diverge.tsv', diverge);
dump('cmt-loc-only.tsv', locOnly);
// bd_material_out 细看
console.log('--- bd_material_out 分歧/独有样例(前12) ---');
[...diverge, ...srvOnly].filter(([k]) => k.startsWith('bd_material_out')).slice(0, 12)
  .forEach(([k, s, l]) => console.log(`  [${k.split('\t')[1]}] 服务器: ${s.slice(0, 60)}  ⇔  本地: ${l.slice(0, 60)}`));
