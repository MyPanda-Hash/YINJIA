/**
 * 探针 v2:生产加工单「按订单行排产」与「拆单」严格验证(2026-09-21)
 * 用法: node tools/archive/_probe-manu-schedule-verify.cjs [baseUrl] [订单号]
 * 覆盖:①按行 1:1 生成 ②重复生成按行跳过(增量) ③拆单等分(字段落值/合计守恒,由 SQL 侧复核)
 *       ④显式拆分数量合计校验 ⑤打印待清理单号
 * 只做生成/拆单,不做删除(SQL 侧硬删,避免留作废痕迹)。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8091') + '/api';
const SO = process.argv[3] || 'LZW-20260917-03';

const log = (...a) => console.log(...a);
const ok = (m) => log('✅ ' + m);
const bad = (m) => { console.log('❌ ' + m); process.exitCode = 1; };

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

(async () => {
  const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' });
  const token = login.json?.data?.token;
  if (!token) { bad('登录失败'); return; }
  ok('登录成功');

  // ① 按行生成
  const gen = await call('SO_ORDER', '生成生产加工单', { 编号: SO }, {}, token);
  const created = gen.json?.data?.['编号清单'] || [];
  log(`① 生成:状态 ${gen.status} 张数=${gen.json?.data?.['生成张数']} 编号=${created.join(',') || gen.text.slice(0, 160)}`);
  created.length >= 2 ? ok(`按行生成 ${created.length} 张(订单 ${SO})`) : bad('未按行生成多张');

  // ② 重复生成 → 应被增量跳过守卫拒绝
  const again = await call('SO_ORDER', '生成生产加工单', { 编号: SO }, {}, token);
  const msg2 = again.json?.message || again.text || '';
  /均已排产|已排产/.test(msg2) ? ok('重复生单被拒:' + msg2.slice(0, 60)) : bad('重复生单未按预期拒绝: ' + msg2.slice(0, 120));

  // ③ 拆单等分(首张拆 3 份)
  const parent = created[0];
  const split = await call('MANU_ORDER', '拆单', { 编号: parent }, { 拆分数: 3 }, token);
  const children = split.json?.data?.['编号清单'] || [];
  log(`③ 拆单:父 ${parent} → 子 ${children.join(',') || split.text.slice(0, 160)}`);
  children.length === 2 ? ok('拆单生成 2 张子单') : bad('拆单张数异常');

  // ④ 显式拆分数量合计不一致 → 应拒绝
  const second = created[1];
  const badSplit = await call('MANU_ORDER', '拆单', { 编号: second }, { 拆分数量: '1,2,3' }, token);
  const msg4 = badSplit.json?.message || badSplit.text || '';
  /不一致/.test(msg4) ? ok('显式拆分合计校验生效:' + msg4.slice(0, 60)) : bad('合计校验未生效: ' + msg4.slice(0, 120));

  log('MARK_CREATED=' + JSON.stringify(created));
  log('MARK_CHILDREN=' + JSON.stringify(children));
  log('MARK_PARENT=' + parent);
})();
