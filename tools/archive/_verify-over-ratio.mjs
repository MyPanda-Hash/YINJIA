/**
 * _verify-over-ratio.mjs — 分批送料「超送」新口径验证(2026-09-22)
 *
 * 用户口径:① 可送上限**按订单全部数量算** = 订单数量×(1+超送比例)−已送+已退回
 *          (旧口径 剩余×(1+比例) 分批越多额度越少,是错的);② 超送比例**最高 50%**。
 *
 * 断言:
 *   ① 未送时 可送上限 = 订单数量×(1+系统比例);
 *   ② 送一批后 可送上限 = 订单数量×(1+比例)−已送(≠ 剩余×(1+比例),两者数值可区分);
 *   ③ 送满订单(剩余=0)后行仍在列表,可送上限 = 订单数量×比例(超送额度);
 *   ④ 超送额度内可继续生单(剩余=0 也能送超送部分);
 *   ⑤ 累计到顶后 可送上限=0,再送被拒且报错含「订单数量」;
 *   ⑥ 弹窗比例覆盖 0.8 被钳到 0.5:按 1.5×订单数量 能送过(若未钳,1.5Q > 1.05Q 会被拒)。
 *
 * 用法: node tools/archive/_verify-over-ratio.mjs   (env: YJ_API)
 */
import { createRequire } from 'node:module';
import { fetchRetry } from './_apifetch.mjs';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };
const info = (m) => console.log(`         ${m}`);
const near = (a, b) => Math.abs(Number(a) - Number(b)) <= 0.011;

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const one = async (s) => (await q(s))[0] || null;

const lj = await (await fetchRetry(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const raw = async (url, body) => (await (await fetchRetry(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json());
const post = async (url, body) => {
  const j = await raw(url, body);
  if (j.code !== 0 && j.code !== 200) throw new Error(JSON.stringify(j).slice(0, 260));
  return j.data;
};
const cb = (p, b, f) => post('/px/callButton', { panelCode: p, buttonName: b, formData: f || {}, buttonParam: {} });
const lines = async (no) => (await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no }));
const gen = async (no, lineKey, qty, overRatio) => post('/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no, lines: [{ lineKey, qty }], ...(overRatio !== undefined ? { overRatio } : {}) });

// ── 选样:两张已审核订单,各找一行 数量≥10(整数口径,数字好算) ──
console.log('=== 选样 ===');
const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 }))?.list || [];
const pick = [];
for (const r of list) {
  if (N(r['单据状态']) !== '已审核') continue;
  const no = N(r['单据编号']);
  if (pick.some((p) => p.no === no)) continue;
  let ls;
  try { ls = await lines(no); } catch { continue; }
  const line = (ls?.lines || []).find((x) => Number(x.剩余数量) >= 10 && Number(x.数量) >= 10);
  if (!line) continue;
  pick.push({ no, line, ratio: Number(ls?.overRatio || 0) });
  if (pick.length === 2) break;
}
function N(v) { return v === null || v === undefined ? null : String(v).trim(); }
if (pick.length < 2) { console.error('找不到两张数量足够的已审核采购订单'); await pool.close(); process.exit(1); }
const [A, B] = pick;
console.log(`  订单① ${A.no}:行${A.line.行号} 数量=${A.line.数量} 剩余=${A.line.剩余数量},系统比例=${A.ratio}`);
console.log(`  订单② ${B.no}:行${B.line.行号} 数量=${B.line.数量} 剩余=${B.line.剩余数量}`);
const created = [];
const track = (no) => created.push(no);

// ═══ ① 基线:可送上限 = 订单数量×(1+比例) − 已送 + 已退回(行可能有历史送量) ═══
console.log('\n=== ① 可送上限 = 订单数量×(1+比例)−已送+已退回 ===');
const Q = Number(A.line.数量);
const l1 = (await lines(A.no)).lines.find((x) => x.lineKey === A.line.lineKey);
const sent0 = Number(l1.已送数量 || 0);
const ret0 = Number(l1.已退回数量 || 0);
const round = (v) => Math.round(v * 100) / 100;
const totalCap = round(Q * (1 + A.ratio) - sent0 + ret0);
info(`订单数量=${Q} 已送=${sent0} 已退=${ret0} 比例=${A.ratio} → 总额度 ${totalCap},实得 ${l1.可送上限}`);
ok(near(l1.可送上限, totalCap), `① 可送上限 = ${Q}×(1+${A.ratio})−${sent0}+${ret0} = ${totalCap}(实得 ${l1.可送上限})`);

// ═══ ② 再送 10:可送上限 = 总额度−已送(不是 剩余×(1+比例)) ═══
console.log('\n=== ② 送一批后:额度按"总额度−已送"递减 ===');
const g1 = await gen(A.no, A.line.lineKey, 10);
track(N(g1['编号']));
const l2 = (await lines(A.no)).lines.find((x) => x.lineKey === A.line.lineKey);
const expNew = round(totalCap - 10);
const expOld = round(Number(l2.剩余数量) * (1 + A.ratio));
info(`再送 10:剩余=${l2.剩余数量};新口径期望 ${expNew},旧口径会是 ${expOld},实得 ${l2.可送上限}`);
ok(near(l2.可送上限, expNew) && !near(l2.可送上限, expOld), `② 可送上限 = 总额度−已送 = ${expNew} 而非 剩余×(1+比例) = ${expOld}(实得 ${l2.可送上限})`);

// ═══ ③ 送满订单:剩余=0,行仍在,可送上限 = 订单数量×比例 ═══
console.log('\n=== ③ 送满订单:剩余=0 仍有超送额度 ===');
const rest = Number(l2.剩余数量);
if (rest > 0) { const g2 = await gen(A.no, A.line.lineKey, rest); track(N(g2['编号'])); }
const l3 = (await lines(A.no)).lines.find((x) => x.lineKey === A.line.lineKey);
const overLeft = Q * A.ratio;
info(`剩余=${l3.剩余数量},行还在列表=${!!l3},可送上限=${l3?.可送上限}(期望 ${overLeft})`);
ok(!!l3 && Number(l3.剩余数量) === 0, `③ 剩余=0 的行仍在可选列表(旧口径下会被剔除/上限=0)`);
ok(near(l3.可送上限, overLeft) && overLeft > 0, `③ 可送上限 = 订单数量×比例 = ${overLeft}(实得 ${l3.可送上限})`);

// ═══ ④ 超送额度内可生单 ═══
console.log('\n=== ④ 超送额度内生单 ===');
const g3 = await gen(A.no, A.line.lineKey, Number(l3.可送上限));
track(N(g3['编号']));
const l4 = (await lines(A.no)).lines.find((x) => x.lineKey === A.line.lineKey);
info(`超送后可送上限=${l4?.可送上限}`);
ok(near(l4.可送上限, 0), `④ 累计送满 订单×(1+比例) 后可送上限=0(实得 ${l4?.可送上限})`);

// ═══ ⑤ 再送被拒,报错含「订单数量」 ═══
console.log('\n=== ⑤ 超上限被拒 ===');
let e5 = '';
try { await gen(A.no, A.line.lineKey, 1); } catch (e) { e5 = String(e.message); }
info(e5.slice(0, 140));
ok(e5.includes('订单数量'), `⑤ 报错按新口径说明(含「订单数量」):${e5.slice(0, 70)}…`);

// ═══ ⑥ 覆盖比例 0.8 → 钳到 0.5:按 订单×1.5−已送 恰好送到顶 ═══
console.log('\n=== ⑥ 弹窗比例覆盖钳制(0.8 → 0.5) ===');
const lB = (await lines(B.no)).lines.find((x) => x.lineKey === B.line.lineKey);
const QB = Number(lB.数量);
const sentB0 = Number(lB.已送数量 || 0);
const target6 = round(QB * 1.5 - sentB0);      // 钳到 0.5 后的满额度
info(`订单② 数量=${QB} 已送=${sentB0} → 按 50% 的总额度 = ${target6};传 overRatio=0.8 送 ${target6}`);
let g6 = null;
try { g6 = await gen(B.no, B.line.lineKey, target6, 0.8); track(N(g6['编号'])); }
catch (e) { info(`生单被拒:${String(e.message).slice(0, 120)}`); }
const l6 = (await lines(B.no)).lines.find((x) => x.lineKey === B.line.lineKey);
ok(!!g6 && near(l6.已送数量, target6), `⑥ 送 ${target6} 成功 → 覆盖比例被钳到 0.5(若按 0.8,上限会是 ${round(QB * 1.8 - sentB0)};若未提高比例,上限只有 ${round(QB * 1.05 - sentB0)});实得已送=${l6.已送数量}`);
let e6 = '';
try { await gen(B.no, B.line.lineKey, 1, 0.8); } catch (e) { e6 = String(e.message); }
info(e6.slice(0, 140));
ok(e6.includes('订单数量'), `⑥ 钳制后再送被拒且报上限明细(累计已到 订单×1.5):${e6.slice(0, 60)}…`);

// ═══ 清理:所有生成的暂收单 反序 弃审→删除(释放占用;批次号按口径不回收) ═══
console.log('\n=== 清理测试单据 ===');
for (const no of created.reverse()) {
  if (!no) continue;
  for (const b of ['弃审', '删除']) {
    try { await cb('QC_RECV', b, { 编号: no }); console.log(`  QC_RECV ${no} ${b} ✓`); }
    catch (e) { console.log(`  QC_RECV ${no} ${b} 跳过:${String(e.message).slice(0, 80)}`); }
  }
}
const lEnd = (await lines(A.no)).lines.find((x) => x.lineKey === A.line.lineKey);
ok(near(lEnd.剩余数量, Q - sent0 + ret0) && near(lEnd.可送上限, totalCap),
  `清理后订单①本探针的占用全部释放(剩余 ${lEnd.剩余数量} = 数量${Q} − 历史已送${sent0};可送上限回到 ${totalCap})`);

await pool.close();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
