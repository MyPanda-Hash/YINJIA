/**
 * _smoke-after-rebuild-20261017.mjs — 重打重启后对 8090 现役实例的冒烟(只读)。
 *
 * 实测的 getPanelConfig 形状(别猜):
 *   data.metadata{...} · data.dataSchema.fields[]=**表头**字段 · data.detail.tabs[].fields[]=**明细**字段
 *   字段对象 = { dataName, dataType, width, isRequired, readonly, options? }
 *
 * 验什么:
 *   ① 登录(admin/123456,账套 YJ=正式库)能拿到 token;
 *   ② 合并进来的功能在**现役实例**上真下发:QC_PROC_INSP 明细有「产线常规功能性结果」、
 *      QC_ASM_INSP 有「检验类型」+ 必填「合格数量」(本次合并的成果);
 *   ③ 本次「服务器配置反向同步」的成果可见:QC_INSP_REQ_SERIES 明细 34 字段且含
 *      检验方法1..7/检验标准1..7(那 30 条 yj_field 刚从服务器快照同步进来);
 *   ④ 四单之一 PURCHASE_IN 仍能取配置(回归)。
 *
 * 用法:node tools/archive/_smoke-after-rebuild-20261017.mjs [BASE]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090';

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json());
if (!login?.data?.token) { console.log('[FAIL] 登录失败:', JSON.stringify(login).slice(0, 300)); process.exit(1); }
console.log(`[OK] 登录成功(账套 YJ) token 长度 ${login.data.token.length}`);

const cfgOf = async (panel) => {
  const r = await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${panel}`, {
    headers: { Authorization: 'Bearer ' + login.data.token },
  });
  if (!r.ok) throw new Error(`${panel} HTTP ${r.status}`);
  return (await r.json()).data;
};
/** 表头 + 明细全部字段拉平 */
const allFields = (d) => [
  ...((d?.dataSchema?.fields) || []),
  ...(((d?.detail?.tabs) || []).flatMap((t) => t.fields || [])),
];
const names = (d) => allFields(d).map((f) => f.dataName);

let bad = 0;
const check = (name, ok, detail) => { console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) bad++; };

try {
  const n = names(await cfgOf('QC_PROC_INSP'));
  check('QC_PROC_INSP 有「产线常规功能性结果」(合并成果)', n.includes('产线常规功能性结果'), `共 ${n.length} 字段`);
} catch (e) { check('QC_PROC_INSP 取面板配置', false, e.message); }

try {
  const d = await cfgOf('QC_ASM_INSP');
  const n = names(d);
  check('QC_ASM_INSP 有「检验类型」(合并成果)', n.includes('检验类型'), `共 ${n.length} 字段`);
  const pass = allFields(d).find((f) => f.dataName === '合格数量');
  check('QC_ASM_INSP 有「合格数量」且必填(合并成果)', !!pass && pass.isRequired === true,
    pass ? `isRequired=${pass.isRequired}` : '未找到');
} catch (e) { check('QC_ASM_INSP 取面板配置', false, e.message); }

try {
  const d = await cfgOf('QC_INSP_REQ_SERIES');
  const n = names(d);
  const want = ['检验方法1', '检验标准1', '检验方法7', '检验标准7'];
  const hit = want.filter((w) => n.includes(w));
  check('QC_INSP_REQ_SERIES 下发含同步进来的自定义列', hit.length === want.length,
    `命中 ${hit.length}/${want.length}(${hit.join('/')});共 ${n.length} 字段`);
  check('QC_INSP_REQ_SERIES 字段数 ≥ 34(1 表头 + 34 明细)', n.length >= 34, `实际 ${n.length}`);
} catch (e) { check('QC_INSP_REQ_SERIES 取面板配置', false, e.message); }

try {
  const n = names(await cfgOf('QC_INSP_REQ'));
  check('QC_INSP_REQ 下发含「外径3」(同步进来的自定义列)', n.includes('外径3'), `共 ${n.length} 字段`);
} catch (e) { check('QC_INSP_REQ 取面板配置', false, e.message); }

try {
  const n = names(await cfgOf('PURCHASE_IN'));
  check('PURCHASE_IN 取面板配置(四单回归)', n.length > 100, `共 ${n.length} 字段`);
} catch (e) { check('PURCHASE_IN 取面板配置', false, e.message); }

console.log(bad === 0 ? '\n[PASS] 冒烟全过(重打重启后的现役实例与合并/同步一致)' : `\n[FAIL] ${bad} 项未过`);
process.exit(bad === 0 ? 0 : 1);
