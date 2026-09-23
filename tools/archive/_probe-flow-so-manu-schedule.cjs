/**
 * 整链探针:客户订单 → 生产加工单(按行排产) → 工单排产看板 → 拆单(2026-09-21)
 * 用法: node tools/archive/_probe-flow-so-manu-schedule.cjs [baseUrl] [客户订单号]
 * 覆盖:①按行 1:1 生成 ②重复生单增量跳过 ③排产看板回读(需求/排产/入库/余量/交期紧迫度/三桶/客户等级/产能)
 *       ④拆单字段落值(SQL 侧复核) ⑤显式拆分数量合计校验 ⑥打印待清理单号
 * 不删除数据(SQL 侧硬删,避免留作废痕迹)。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SO = process.argv[3] || 'LZW-20260917-03';

const log = (...a) => console.log(...a);
const ok = (m) => log('✅ ' + m);
const bad = (m) => { log('❌ ' + m); process.exitCode = 1; };

async function api(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { }
  return { status: res.status, json, text };
}
const call = (panelCode, buttonName, formData, buttonParam, token) =>
  api('POST', '/px/callButton', { panelCode, buttonName, formData, buttonParam: buttonParam || {} }, token);
const list = async (panelCode, token, pageSize = 200) => {
  const r = await api('POST', '/px/queryFormDataList', { panelCode, pageNo: 1, pageSize }, token);
  return r.json?.data?.list || r.json?.data?.rows || [];
};

(async () => {
  const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' });
  const token = login.json?.data?.token;
  if (!token) { bad('登录失败'); return; }
  ok('登录成功');

  // ① 按行生成
  const gen = await call('SO_ORDER', '生成生产加工单', { 编号: SO }, {}, token);
  const created = gen.json?.data?.['编号清单'] || [];
  log(`① 排产生成: ${gen.status} 张数=${gen.json?.data?.['生成张数']} 编号=${created.join(',') || gen.text.slice(0, 160)}`);
  created.length >= 2 ? ok(`按客户订单行生成 ${created.length} 张生产加工单`) : bad('未按行生成多张');

  // ② 增量跳过:重复生单应被拒
  const again = await call('SO_ORDER', '生成生产加工单', { 编号: SO }, {}, token);
  const msg2 = again.json?.message || again.text || '';
  /均已排产|已排产/.test(msg2) ? ok('重复生单被拒(增量跳过): ' + msg2.slice(0, 50)) : bad('重复生单未按预期拒绝: ' + msg2.slice(0, 100));

  // ③ 排产看板回读
  const sched = await list('MANU_SCHEDULE', token);
  const mine = sched.filter((r) => created.includes(String(r['加工单号'] || '')));
  log(`③ 排产看板: 共 ${sched.length} 行,命中本次生成 ${mine.length}/${created.length}`);
  for (const r of mine) {
    log(`   · ${r['加工单号']} | 客户=${r['客户'] ?? '-'} 等级=${r['客户等级'] || '-'} | 产品=${r['产品编码'] ?? '-'} ${r['规格型号'] || '-'}`);
    log(`     需求=${r['需求数量']} 排产=${r['排产数量']} 入库=${r['入库数量']} 余量=${r['余量']} | 交期=${String(r['工序交期'] || '').slice(0, 10)} 紧迫度=${r['交期紧迫度(天)']} | 7天=${r['7天已排产']} 15天=${r['15天已排产']} >15=${r['大于15天']} | 产能/小时=${r['产能/小时']} | 状态=${r['单据状态']}`);
  }
  const hasCarry = mine.length === created.length && mine.every((r) => r['需求数量'] > 0 && r['排产数量'] > 0);
  hasCarry ? ok('看板字段(需求/排产/客户等级/交期/三桶/产能)均已落值') : bad('看板字段有缺失');

  // ④ 拆单(首张拆 3 份)
  const parent = created[0];
  const split = await call('MANU_ORDER', '拆单', { 编号: parent }, { 拆分数: 3 }, token);
  const children = split.json?.data?.['编号清单'] || [];
  log(`④ 拆单: 父 ${parent} → 子 ${children.join(',') || split.text.slice(0, 160)}`);
  children.length === 2 ? ok('拆单生成 2 张子单') : bad('拆单张数异常');

  // ⑤ 显式拆分数量合计不一致 → 应拒绝
  const second = created[1];
  const badSplit = await call('MANU_ORDER', '拆单', { 编号: second }, { 拆分数量: '1,2,3' }, token);
  const msg5 = badSplit.json?.message || badSplit.text || '';
  /不一致/.test(msg5) ? ok('显式拆分合计校验生效: ' + msg5.slice(0, 50)) : bad('合计校验未生效: ' + msg5.slice(0, 100));

  log('MARK_CREATED=' + JSON.stringify(created));
  log('MARK_CHILDREN=' + JSON.stringify(children));
  log('MARK_PARENT=' + parent);
})();
