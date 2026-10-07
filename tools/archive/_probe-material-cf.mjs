// _probe-material-cf.mjs — 商品(BD_MATERIAL)金蝶自定义字段清点:键、窗口、取值、来料检验命中
//
// 【为什么要有这份探针】2026-10-03 真实账套(359797)商品档案新增第 4 个自定义字段「来料检验」,
//   要把它接进同步器,必须先把三件事查实(接口不返回自定义字段的显示名,只能靠实测取证):
//     ① 该账套商品 custom_field 到底有哪几个键(老键别认错);
//     ② 列表接口能不能看出自定义字段改动(决定指纹能不能用);
//     ③ 哪个键是来料检验(取值是不是 是/否)、谁填了值。
//   实测结论(2026-10-03):
//     · custom_field 共 4 键——前 3 键是长期有值的老字段(规格/装箱量:值形如 57*21*66.5、108支/箱),
//       第 4 键 custom_field__1__62tvoyr1j4fa 取值只有「是」⇒ 即「来料检验」;
//     · 商品**列表**接口(35 键)既没有 custom_field 也没有 modify_time ⇒ 指纹对自定义字段永久免疫,
//       不同步器主动重取详情就永远同步不到(存量 3837 行只有 1 行有值即为证);
//     · 列表接口**支持** modify_start_time/modify_end_time(近7天16条/14天33条/31天110条/60天781条),
//       且自定义字段编辑**会**推进商品 modify_time(8 个「来料检验=是」的商品正落在近 7 天窗口内)
//       ⇒ 同步器据此做「近 N 天改动 → 每天各重取一次详情」的自定义字段复核(见 sync-core.mjs);
//     · 按自定义字段过滤**不支持**(字段名当参数/custom_field.前缀/filter= 均返回全量 3852 条),
//       所以只能按窗口圈定 + 取详情。
//
// 只读(GET),不写库、不写金蝶。
// 用法:node tools/archive/_probe-material-cf.mjs [窗口天数=60] [键ID=custom_field__1__62tvoyr1j4fa]
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const DAYS = Number(process.argv[2] || 60);
const KEY = process.argv[3] || 'custom_field__1__62tvoyr1j4fa';
const now = Date.now();
const { token } = await fetchAppToken(cfg.kingdee);
console.log('账套 clientId=%s domain=%s', cfg.kingdee.clientId, cfg.kingdee.domain);

// ── ① 列表键:有没有 custom_field / modify_time ──
const l0 = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/material', { page: '1', page_size: '1' });
const lk = Object.keys((l0.rows || [])[0] || {});
console.log('\n① 商品列表:共 %s 条,%d 键', l0.count, lk.length);
console.log('   custom_field?', lk.includes('custom_field') ? '有' : '❌ 无(指纹看不到自定义字段)');
console.log('   modify_time?  ', lk.includes('modify_time') ? '有' : '❌ 无');

// ── ② 时间窗条数(同步器复核窗口的定档依据)──
console.log('\n② 列表 modify 时间窗条数:');
for (const d of [1, 3, 7, 14, 31, 60, 90]) {
  const r = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/material', {
    page: '1', page_size: '1',
    modify_start_time: String(now - d * 86400000), modify_end_time: String(now + 180 * 60000),
  });
  console.log('   近 %s 天:%s 条', String(d).padStart(2), r.count);
}

// ── ③ 窗口内逐条详情:各键取值分布 + 目标键命中 ──
const win = { modify_start_time: String(now - DAYS * 86400000), modify_end_time: String(now + 180 * 60000) };
const rows = [];
for (let page = 1; page <= 100; page++) {
  const d = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/material', { page: String(page), page_size: '100', ...win });
  rows.push(...(d.rows || []));
  if (page >= Number(d.total_page || 1)) break;
}
console.log('\n③ 近 %d 天改动的商品 %d 条,逐条取详情 …', DAYS, rows.length);

const stat = new Map();
const hits = [];
let n = 0;
for (const r of rows) {
  const d = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/material_detail', { id: r.id });
  n++;
  if (n % 100 === 0) process.stdout.write(`   进度 ${n}/${rows.length}\r`);
  let cf = d.custom_field;
  if (typeof cf === 'string') { try { cf = JSON.parse(cf); } catch { cf = {}; } }
  for (const [k, v] of Object.entries(cf || {})) {
    const s = stat.get(k) || { filled: 0, vals: new Map() };
    const sv = String(v ?? '').trim();
    if (sv) { s.filled++; s.vals.set(sv, (s.vals.get(sv) || 0) + 1); }
    stat.set(k, s);
  }
  const sv = String((cf || {})[KEY] ?? '').trim();
  if (sv) hits.push({ id: d.id, number: d.number, name: d.name, model: d.model, value: sv });
}
console.log('\n   各自定义字段非空情况(共扫 %d 条):', n);
for (const [k, s] of stat) {
  console.log('   %s | 非空 %d/%d | %s', k, s.filled, n, JSON.stringify([...s.vals.entries()].slice(0, 6)));
}
console.log('\n   目标键 %s 命中 %d 条:', KEY, hits.length);
for (const h of hits.slice(0, 40)) console.log('     %s %s = %s', h.number, h.name, h.value);

const out = new URL('./_material-cf-probe.json', import.meta.url);
writeFileSync(out, JSON.stringify({
  probedAt: new Date().toISOString(), clientId: cfg.kingdee.clientId, windowDays: DAYS, key: KEY,
  listKeys: lk, scanned: n, total: Number(l0.count),
  keys: [...stat.entries()].map(([k, s]) => ({ key: k, filled: s.filled, values: [...s.vals.entries()] })),
  hits,
}, null, 2), 'utf8');
console.log('\n明细已写出:', out.pathname);
