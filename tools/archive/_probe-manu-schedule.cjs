/**
 * 探针:生产加工单「按订单行排产生成」+「拆单」端到端验证(2026-09-21)
 * 用法: node tools/archive/_probe-manu-schedule.cjs [baseUrl]
 * 验证:SO_ORDER 生成生产加工单(按行 1:1)→ MANU_ORDER 落值 → 拆单 → 清理测试痕迹
 * 契约:callButton {panelCode,buttonName,formData,buttonParam};结果包在 ApiResult.data
 */
const API = (process.argv[2] || 'http://127.0.0.1:8091') + '/api';
const SO = process.env.PROBE_SO || 'LZW-20260917-03';

async function api(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: res.status, json, text };
}

const log = (...a) => console.log(...a);
const fail = (msg) => { console.error('❌ ' + msg); process.exitCode = 1; };
const ok = (msg) => log('✅ ' + msg);

(async () => {
  // 1) 登录
  const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' });
  const token = login.json?.data?.token;
  if (!token) { fail('登录失败: ' + login.status + ' ' + login.text.slice(0, 200)); return; }
  ok('登录成功');

  // 2) 确认来源订单已审核
  const soList = await api('POST', '/px/queryFormDataList', { panelCode: 'SO_ORDER', pageNo: 1, pageSize: 50 }, token);
  const soRows = soList.json?.data?.list || soList.json?.data?.rows || [];
  const so = soRows.find((r) => (r['编号'] || r['单据编号']) === SO);
  if (!so) { fail(`订单列表未找到 ${SO}(共 ${soRows.length} 行)`); return; }
  log(`   订单 ${SO} 单据状态=${so['单据状态'] || '-'} 客户=${so['客户'] || '-'}`);

  // 3) 按订单行生成生产加工单
  const gen = await api('POST', '/px/callButton', {
    panelCode: 'SO_ORDER', buttonName: '生成生产加工单', formData: { 编号: SO }, buttonParam: {},
  }, token);
  if (!gen.json || gen.json.code !== 0 && gen.json.code !== 200) { fail('生单失败: ' + gen.status + ' ' + gen.text.slice(0, 300)); return; }
  const g = gen.json.data || {};
  log('   生单返回: ' + JSON.stringify(g));
  const created = g['编号清单'] || (g['编号'] ? [g['编号']] : []);
  if (created.length === 0) { fail('未返回生成的加工单号'); return; }
  ok(`按行生成 ${g['生成张数'] ?? created.length} 张加工单: ${created.join(', ')}`);

  // 4) 回读加工单头/行,断言带入
  const manuList = await api('POST', '/px/queryFormDataList', { panelCode: 'MANU_ORDER', pageNo: 1, pageSize: 100 }, token);
  const manuRows = manuList.json?.data?.list || manuList.json?.data?.rows || [];
  const mine = manuRows.filter((r) => created.includes(r['编号'] || r['合同号']));
  log(`   回读命中 ${mine.length}/${created.length} 张`);
  for (const r of mine.slice(0, 3)) {
    log(`   · ${r['编号'] || r['合同号']} | 销售订单号=${r['销售订单号'] ?? '-'} | 客户=${r['客户'] ?? '-'} | 预完工日=${r['预完工日'] ?? '-'} | 需求数量=${r['需求数量'] ?? '-'} | 排产数量=${r['排产数量'] ?? '-'} | 来源单号=${r['来源单号'] ?? '-'}`);
  }
  const withSo = mine.filter((r) => String(r['销售订单号'] || '') === SO).length;
  if (withSo === mine.length && mine.length > 0) ok('全部加工单均带销售订单号'); else fail(`销售订单号带入 ${withSo}/${mine.length}`);

  // 5) 拆单(首张拆 3 份)
  const first = created[0];
  const split = await api('POST', '/px/callButton', {
    panelCode: 'MANU_ORDER', buttonName: '拆单', formData: { 编号: first }, buttonParam: { 拆分数: 3 },
  }, token);
  log('   拆单返回: ' + JSON.stringify(split.json?.data || split.text.slice(0, 200)));
  const children = split.json?.data?.['编号清单'] || [];
  if (children.length === 2) ok(`拆单生成 ${children.length} 张子单: ${children.join(', ')}`); else fail('拆单结果异常');

  // 6) 清理测试痕迹(删除下游草稿会自动释放 form_flow_link 占用)
  const all = [...created, ...children];
  let deleted = 0;
  for (const no of all) {
    const d = await api('POST', '/px/deleteForms', { panelCode: 'MANU_ORDER', rowCodes: [no] }, token);
    if (d.status === 200) deleted++; else log(`   删除 ${no} 失败: ${d.status} ${d.text.slice(0, 120)}`);
  }
  ok(`已清理测试单据 ${deleted}/${all.length}`);
  log('PROBE_DONE created=' + JSON.stringify(created) + ' children=' + JSON.stringify(children));
})();
