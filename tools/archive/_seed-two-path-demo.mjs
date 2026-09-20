/**
 * _seed-two-path-demo.mjs — 本地造两条测试数据,演示采购链的两条下游路径(**保留数据,不清库**)
 * 用法: node tools/archive/_seed-two-path-demo.mjs
 *
 * 路径①(全合格):采购订单 → 送料暂收单 → 来料检验单(全合格) → **仅采购入库单**
 * 路径②(含不良):采购订单 → 送料暂收单 → 来料检验单(1 全不良 / 2 全合格 / 3 各半)
 *                → **采购入库单(合格行) + 暂收退回单(不良行)**
 *
 * 说明:生成的采购入库单/暂收退回单留**草稿**(不自动审核,避免产生库存记账副作用),
 *       送料暂收单/来料检验单为已审核(链路要求)。源订单会被占用(选单里不再出现),
 *       删掉这些下游草稿即自动释放。
 */
const API = process.env.YJ_API || 'http://127.0.0.1:8090/api';

const CASES = [
  {
    no: 'YJ-20260915-06', path: '① 全合格 → 仅采购入库单',
    plan: (i, q) => ({ ok: q, bad: 0 }),
  },
  {
    no: 'YJ-20260915-08', path: '② 含不良 → 采购入库单 + 暂收退回单',
    // 行1 全不良(只进退回)、行2 全合格(只进入库)、行3 各半(两边都有)
    plan: (i, q) => (i === 0 ? { ok: 0, bad: q } : i === 1 ? { ok: q, bad: 0 } : { ok: Math.floor(q / 2), bad: q - Math.floor(q / 2) }),
  },
];

let token = '';
const call = async (path, body, method = 'POST') => {
  const r = await fetch(API + path, {
    method, headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  });
  return r.json();
};
const btn = (panelCode, buttonName, formData) => call('/px/callButton', { panelCode, buttonName, formData, buttonParam: {} });
const list = async (pc) => (await call('/px/queryFormDataList', { panelCode: pc, condition: {}, pageNo: 1, pageSize: 500 })).data?.list || [];
const findDoc = async (pc, no) => (await list(pc)).find((r) => String(r['编号'] || r['单据编号'] || r['单号']) === String(no));
const n = (v) => { const x = Number(String(v ?? '').trim()); return Number.isFinite(x) ? x : 0; };
const lineOf = (x, key) => ({ 行号: x[key] ?? '', 物料: x['物料编码'] || x['存货编码'] || '', 数量: x['数量'] ?? x['实收数量'] ?? x['送检数量'] ?? x['退货数量'] ?? '', 单位: x['计量单位'] || x['单位'] || '', 单价: x['单价'] ?? '' });

(async () => {
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json();
  token = lj?.data?.token;
  if (!token) throw new Error('登录失败');
  console.log(`[登录] ok | 后端 ${API}\n`);

  const out = [];
  for (const c of CASES) {
    console.log(`══════ ${c.path} | 源订单 ${c.no} ══════`);
    const order = await findDoc('PU_ORDER', c.no);
    if (!order) throw new Error('源订单不存在:' + c.no);
    const orderLines = (order.detail?.items || []).map((x) => lineOf(x, '行号'));
    console.log(`  订单行: ${JSON.stringify(orderLines)}`);

    // 1) 送料暂收单
    const slNo = (await btn('PU_ORDER', '生成送料暂收单', { 编号: c.no })).data?.['编号'];
    if (!slNo) throw new Error('生暂收单失败');
    await btn('SL_RECV', '审核', { 编号: slNo });
    const sl = await findDoc('SL_RECV', slNo);
    console.log(`  送料暂收单 ${slNo}(已审核) 采购订单号=${sl['采购订单号']} 行=${JSON.stringify((sl.detail?.items || []).map((x) => lineOf(x, '采购订单行号')))}`);

    // 2) 来料检验单
    const qcNo = (await btn('SL_RECV', '生成来料检验单', { 编号: slNo })).data?.['编号'];
    if (!qcNo) throw new Error('生检验单失败');
    let qc = await findDoc('QC_INSP', qcNo);
    const items = (qc.detail?.items || []).map((it, i) => {
      const q = n(it['送检数量']) || n(it['数量']);
      const { ok, bad } = c.plan(i, q);
      return { ...it, 合格数量: ok, 不合格数量: bad };
    });
    await btn('QC_INSP', '保存', { ...qc, 编号: qcNo, detail: { ...(qc.detail || {}), items } });
    await btn('QC_INSP', '审核', { 编号: qcNo });
    await new Promise((r) => setTimeout(r, 1800));
    qc = await findDoc('QC_INSP', qcNo);
    console.log(`  来料检验单 ${qcNo}(已审核) 采购订单号=${qc['采购订单号']} 行=${JSON.stringify((qc.detail?.items || []).map((x, i) => ({ ...lineOf(x, '采购订单行号'), 合格: x['合格数量'], 不良: x['不合格数量'] })))}`);

    // 3) 汇总两条支路产物
    const piNew = (await list('PURCHASE_IN')).filter((r) => n(r['采购订单号'] ? 1 : 0) && String(r['采购订单号']) === c.no).slice(0, 1);
    const pi = piNew[0];
    const thAll = (await list('QC_RETURN')).filter((r) => String(r['采购订单号'] || '') === c.no);
    const th = thAll[0];
    const rec = { path: c.path, 源订单: c.no, 送料暂收单: slNo, 来料检验单: qcNo,
      采购入库单: pi ? (pi['编号'] || pi['单据编号']) : '(无)', 入库行: pi ? (pi.detail?.items || []).map((x) => lineOf(x, '采购订单行号')) : [],
      暂收退回单: th ? (th['编号'] || th['单据编号']) : '(无)', 退回行: th ? (th.detail?.items || []).map((x) => lineOf(x, '采购订单行号')) : [] };
    out.push(rec);
    console.log(`  → 采购入库单 ${rec.采购入库单} 状态=${pi ? pi['单据状态'] : '-'} 采购订单号=${pi ? pi['采购订单号'] : '-'}`);
    if (pi) console.log(`     入库行: ${JSON.stringify(rec.入库行)}`);
    console.log(`  → 暂收退回单 ${rec.暂收退回单} 状态=${th ? th['单据状态'] : '-'} 采购订单号=${th ? th['采购订单号'] : '-'} 检验单号=${th ? (th['检验单号'] || '') : '-'}`);
    if (th) console.log(`     退回行: ${JSON.stringify(rec.退回行)}`);
    console.log('');
  }

  console.log('══════ 汇总(数据已保留)══════');
  for (const r of out) {
    console.log(`${r.path}`);
    console.log(`   源订单 ${r.源订单} → 暂收 ${r.送料暂收单} → 检验 ${r.来料检验单} → 入库 ${r.采购入库单}${r.暂收退回单 !== '(无)' ? ' + 退回 ' + r.暂收退回单 : ''}`);
  }
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
