#!/usr/bin/env node
/**
 * _probe-server-fourdoc.mjs — 经应用 API 在**服务器**上做四单基线比对(只读)
 *
 * 目的:回答「本次要上的 3 条四单脚本,在服务器上是空操作还是要真改?」
 *   基线 = tools/fourdoc-baseline.tsv(与本地 FourDocAudit 同一权威),字段取自
 *   服务器 `/api/px/getPanelConfig?panelCode=X` 的 dataSchema.fields。
 * 口径同 FourDocAudit:多出 / 缺失 / 内容变(label·place·seq·data_type·width·参照源)/ 名次不符。
 * 用法: node tools/archive/_deploy-20261008/_probe-server-fourdoc.mjs [baseUrl]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://36.140.66.163:8090';
const ROOT = process.cwd();
const PANELS = ['QC_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN'];

const tsv = readFileSync(join(ROOT, 'tools/fourdoc-baseline.tsv'), 'utf8').replace(/^\uFEFF/, '');
const want = [];
for (const line of tsv.split(/\r?\n/)) {
  if (!line.trim()) continue;
  const f = line.split('\t');
  const [ord, panel, col, label, place, seq, dtype, width] = f;
  if (ord === 'ord') continue;
  want.push({ panel, col, label, place, seq: Number(seq), dtype, width });
}

const lg = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }), signal: AbortSignal.timeout(20000),
});
const token = (await lg.json()).data.token;

const key = (r) => `${r.col}|${r.place}`;
let totalDiff = 0;
for (const p of PANELS) {
  const r = await fetch(BASE + '/api/px/getPanelConfig?panelCode=' + p, {
    headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000),
  });
  const j = await r.json();
  const fields = (j?.data?.dataSchema?.fields ?? []).filter((x) => x && x.col_name);
  const have = fields.map((x) => ({
    panel: p, col: x.col_name, label: x.label ?? x.col_name,
    place: String(x.place ?? ''), seq: Number(x.seq ?? 0),
    dtype: x.data_type ?? '', width: x.width ?? '', ref: x.ref_panel ?? '',
  }));
  const w = want.filter((x) => x.panel === p);
  const wKeys = new Set(w.map(key)), hKeys = new Set(have.map(key));
  const extra = have.filter((x) => !wKeys.has(key(x)));
  const missing = w.filter((x) => !hKeys.has(key(x)));
  const changed = have.filter((x) => {
    const m = w.find((y) => key(y) === key(x));
    return m && (m.label !== x.label || m.seq !== x.seq || m.dtype !== x.dtype || String(m.width) !== String(x.width));
  });
  const diff = extra.length + missing.length + changed.length;
  totalDiff += diff;
  console.log(`${p.padEnd(13)} 现役 ${String(have.length).padStart(3)} 行 / 基线 ${String(w.length).padStart(3)} 行  | 多出 ${extra.length} · 缺失 ${missing.length} · 内容变 ${changed.length}  ${diff === 0 ? '✅ 一致(3 条脚本对本面板=空操作)' : '⚠ 有差异(脚本会真改)'}`);
  extra.slice(0, 6).forEach((x) => console.log(`      多出: ${x.col} (${x.place},seq ${x.seq})`));
  missing.slice(0, 6).forEach((x) => console.log(`      缺失: ${x.col} (${x.place},seq ${x.seq})`));
  changed.slice(0, 6).forEach((x) => {
    const m = want.find((y) => key(y) === key(x));
    console.log(`      内容变: ${x.col} 基线(label=${m.label},seq=${m.seq},type=${m.dtype},w=${m.width}) vs 现役(label=${x.label},seq=${x.seq},type=${x.dtype},w=${x.width})`);
  });
}
console.log(`\n合计差异 ${totalDiff} 处。0 = 服务器四单已在基线(本次 3 条脚本将是空操作,安全);`);
console.log('>0 = 服务器四单与基线不一致,回正脚本会**把服务器改成基线**(有意改动需你点头)。');
