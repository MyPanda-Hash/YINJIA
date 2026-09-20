/**
 * _verify-erp-push.mjs — 转ERP 推送实测(测试沙箱 359220):源单关联 7 字段是否真被金蝶落库
 * 用法: node tools/archive/_verify-erp-push.mjs
 * 做法:复制 MES 既有测试入库单 → 补 采购订单号 + 行 采购订单行号 → 审核 → 转ERP → 回读金蝶入库单核对
 * 注:沙箱无采购订单(实测 count=0),故 src_inter_id/src_entry_id 预期不落(走优雅降级);
 *     生产账套有采购订单,该两字段的解析路径已由 _q-po-lookup.mjs 只读验证取值与金蝶自建行一致。
 */
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

const API = 'http://127.0.0.1:8091/api';
const SOURCE_DOC = 'TCGRK-PO-001';          // MES 既有测试入库单(其物料/单位/仓库沙箱已接受过)
/**
 * 作为 src_bill_no 推上去的采购订单号。两种口径都要验:
 *   ① 订单在目标账套存在 → 期望 7 个 src_* 字段全落(src_bill_no/type_id/type_number/type_name/src_seq/src_inter_id/src_entry_id)
 *   ② 订单不在目标账套   → 期望整组不推、推送仍成功、消息里明确提示(不因账套缺单而整单被拒)
 * 用法: node _verify-erp-push.mjs [订单号]
 */
const PO_NO = process.argv[2] || 'YJ-20260916-01';
let token = '';
const call = async (path, body, method = 'POST') => {
  const r = await fetch(API + path, {
    method, headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  });
  return r.json();
};
const btn = (panelCode, buttonName, formData) => call('/px/callButton', { panelCode, buttonName, formData, buttonParam: {} });

(async () => {
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json();
  token = lj?.data?.token;
  if (!token) throw new Error('MES 登录失败');

  // 0) 清理上一轮中断留下的探针单(仅限显式单号)
  for (const no of ['PI-2026-09-0009']) {
    try { await btn('PURCHASE_IN', '弃审', { 编号: no }); } catch { /* 非已审核态 */ }
    const d = await call('/px/deleteForms', { panelCode: 'PURCHASE_IN', rowCodes: [no] });
    if (d.code === 0 || d.code === 200) console.log(`[清理] 上一轮探针单 ${no} 已软删`);
  }
  let newNo = '';
  try {
  // 1.5) 若源采购订单在金蝶存在,按它的分录对齐测试行(数量不得超过订单 → 否则金蝶判"不允许超额入库")
  let orderLine = null;
  try {
    const kk = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8'));
    const cf = kk.kingdee || kk;
    const { token: t2 } = await fetchAppToken(cf);
    const r2 = await kingdeeGet(cf, t2, '/jdy/v2/scm/pur_order', { page: '1', page_size: '5', bill_no: PO_NO });
    const h2 = (r2.rows || []).find((x) => x.bill_no === PO_NO);
    if (h2) {
      const d2 = await kingdeeGet(cf, t2, '/jdy/v2/scm/pur_order_detail', { id: h2.id });
      orderLine = (d2.material_entity || [])[0] || null;
      console.log(`[源单核对] 金蝶采购订单 ${PO_NO} 状态=${d2.bill_status} 分录1: 商品=${orderLine?.material_number} 数量=${orderLine?.qty}`);
    }
  } catch (e) { console.log('[源单核对] 跳过:' + e.message.slice(0, 80)); }

  // 1) 复制源单(去掉单号/ERP痕迹)→ 新草稿,补 采购订单号 + 行 采购订单行号
  const list = (await call('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', condition: {}, pageNo: 1, pageSize: 200 })).data?.list || [];
  const src = list.find((r) => String(r['编号'] || r['单据编号']) === SOURCE_DOC);
  if (!src) throw new Error('源单不存在:' + SOURCE_DOC);
  // 坑:保存接口把带 id 的行当"已有行"处理(按 id 更新 单据编号)→ 会把源单的行挪走,
  // 因此复制时必须剔除 id/__id(以及服务端痕迹字段),保证插入的是全新行。
  const stripIds = (o) => { const c = { ...o }; for (const k of ['id', '__id', '编号', '单据编号', 'ERP单号', 'asp_user1', 'asp_time1', 'asp_user2', 'asp_time2', 'asp_cancel']) delete c[k]; return c; };
  const items = (src.detail?.items || []).map((it, i) => {
    const row = { ...stripIds(it), 采购订单行号: String(i + 1) };
    // 有源单时:数量/单价/商品按订单分录对齐(数量超订单会被金蝶判"不允许超额入库")
    if (orderLine && i === 0) {
      row['存货编码'] = orderLine.material_number ?? row['存货编码'];
      row['存货名称'] = orderLine.material_name ?? row['存货名称'];
      row['实收数量'] = orderLine.qty ?? row['实收数量'];
      row['计量单位'] = orderLine.unit_name ?? row['计量单位'];
      if (orderLine.price != null) row['单价'] = orderLine.price;
    }
    return row;
  });
  console.log(`[源单] ${SOURCE_DOC} 行数=${items.length} 供应商=${src['供应商']} 物料=${items.map((x) => x['存货编码']).join(',')}`);
  const head = { ...stripIds(src), 是否已转ERP: '否', 采购订单号: PO_NO, detail: { ...(src.detail || {}), items } };
  const saved = (await btn('PURCHASE_IN', '保存', head)).data || {};
  newNo = saved['编号'];
  console.log(`[新建] 探针入库单 ${newNo} | 采购订单号=${PO_NO} | 行 采购订单行号=${items.map((x) => x['采购订单行号']).join(',')}`);

  // 2) 审核 → 转ERP
  await btn('PURCHASE_IN', '审核', { 编号: newNo });
  const pushRes = await btn('PURCHASE_IN', '转ERP', { 编号: newNo });
  console.log(`[转ERP 响应] ${JSON.stringify(pushRes).slice(0, 500)}`);
  if (pushRes.code !== 0 && pushRes.code !== 200) throw new Error('推送失败:' + (pushRes.message || '').slice(0, 200));
  const pushed = pushRes.data || {};
  const erpNo = pushed['ERP单号'];
  if (!erpNo) throw new Error('未回写 ERP单号,推送失败');

  // 3) 回读沙箱:该 ERP 单的每行 src_* 字段
  const k = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8'));
  const cfg = k.kingdee || k;
  const { token: kdToken } = await fetchAppToken(cfg);
  const r = await kingdeeGet(cfg, kdToken, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '5', bill_no: erpNo });
  const hit = (r.rows || []).find((x) => x.bill_no === erpNo);
  if (!hit) throw new Error('沙箱未找到刚推送的单:' + erpNo);
  const d = await kingdeeGet(cfg, kdToken, '/jdy/v2/scm/pur_inbound_detail', { id: hit.id });
  console.log(`\n[沙箱回读] ${d.bill_no} 供应商=${d.supplier_name} 行数=${(d.material_entity || []).length}`);
  const fails = [];
  const ok = (c, m, extra = '') => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${m}${extra ? ' :: ' + extra : ''}`); if (!c) fails.push(m); };
  const linked = !/未挂来源单/.test(String(pushed.message || ''));
  console.log(`\n[判定] 本次口径 = ${linked ? '①订单存在 → 期望 7 字段全落' : '②订单缺失 → 期望整组不推 + 明确提示'}`);
  if (!linked) ok(/未找到采购订单/.test(String(pushed.message || '')), '降级提示已回给前端(message 含未找到采购订单)', String(pushed.message || '').slice(0, 80));
  for (const e of (d.material_entity || [])) {
    const row = {
      seq: e.seq, 商品: e.material_number,
      src_bill_no: e.src_bill_no ?? '', src_bill_type_id: e.src_bill_type_id ?? '',
      src_bill_type_number: e.src_bill_type_number ?? '', src_bill_type_name: e.src_bill_type_name ?? '',
      src_seq: e.src_seq ?? '', src_inter_id: e.src_inter_id ?? '', src_entry_id: e.src_entry_id ?? '',
    };
    console.log('   ' + JSON.stringify(row));
    if (linked) {
      ok(String(row.src_bill_no) === PO_NO, `第${row.seq}行 src_bill_no 已落库`, String(row.src_bill_no));
      ok(String(row.src_bill_type_id) === 'pur_bill_order', `第${row.seq}行 src_bill_type_id`, String(row.src_bill_type_id));
      ok(String(row.src_bill_type_number) === 'pur_bill_order', `第${row.seq}行 src_bill_type_number`, String(row.src_bill_type_number));
      ok(String(row.src_bill_type_name) === '采购订单', `第${row.seq}行 src_bill_type_name`, String(row.src_bill_type_name));
      ok(Number(row.src_seq) > 0, `第${row.seq}行 src_seq 已落库(采购订单行号)`, String(row.src_seq));
      ok(String(row.src_inter_id) && String(row.src_inter_id) !== '0', `第${row.seq}行 src_inter_id(订单单据id)`, String(row.src_inter_id));
      ok(String(row.src_entry_id) && String(row.src_entry_id) !== '0', `第${row.seq}行 src_entry_id(订单分录id)`, String(row.src_entry_id));
    } else {
      ok(!row.src_bill_no && Number(row.src_seq) === 0, `第${row.seq}行 未挂来源单(src_* 整组未推)`,
        `src_bill_no=${JSON.stringify(row.src_bill_no)} src_seq=${row.src_seq}`);
    }
  }

  // 4) 清理:MES 探针单弃审(清 ERP 痕迹)+ 软删
  await btn('PURCHASE_IN', '弃审', { 编号: newNo });
  await call('/px/deleteForms', { panelCode: 'PURCHASE_IN', rowCodes: [newNo] });
  console.log(`\n[清理] MES 探针单 ${newNo} 已弃审并软删(沙箱侧单据保留,单号 ${erpNo})`);
  console.log(`\n===== 结果:${fails.length ? 'FAIL ' + fails.length + ' 项' : 'ALL PASS'} =====`);
  fails.forEach((f) => console.log('  ✗', f));
  if (fails.length) process.exitCode = 1;
  } catch (e) {
    // 失败也要收尾:探针单不留在业务可见状态
    if (newNo) {
      try { await btn('PURCHASE_IN', '弃审', { 编号: newNo }); } catch { /* 忽略 */ }
      try { await call('/px/deleteForms', { panelCode: 'PURCHASE_IN', rowCodes: [newNo] }); console.log(`[清理] 失败收尾:探针单 ${newNo} 已软删`); } catch { /* 忽略 */ }
    }
    throw e;
  }
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
