// 订单对齐验证:SO/PU 面板新字段 + 查询 + 建删单 E2E
const BASE = 'http://127.0.0.1:8090/api';
async function api(path, body, token) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}
async function main() {
  const lr = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then((r) => r.json());
  const token = lr.data.token;
  const expect = {
    SO_ORDER: { form: ['币种', '汇率', '结算期限', '备注', '部门负责人'], grid: ['品牌'] },
    PU_ORDER: { form: ['供应商编码', '结算期限', '备注'], grid: ['数量2', '计量单位2', '折扣%', '折扣金额', '备注'] },
  };
  let fail = 0;
  for (const [pc, { form, grid }] of Object.entries(expect)) {
    const cfg = await fetch(`${BASE}/px/getPanelConfig?panelCode=${pc}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    if (cfg.code !== 200) { console.log('[%s] config FAIL %s', pc, cfg.message); fail++; continue; }
    const m = cfg.data.metadata;
    const cols = m.panelPageDto.tablePages[0].gridTabs[0].columns.map(String);
    const formNames = String(m.formPages?.[0]?.fieldNames || '').split(',').filter(Boolean);
    const missForm = form.filter((l) => !formNames.includes(l));
    const missGrid = grid.filter((l) => !cols.includes(l));
    console.log('[%s] 表单字段%d/列%d 表单缺失=%s 列缺失=%s', pc, formNames.length, cols.length,
      missForm.length ? missForm.join(',') : '无', missGrid.length ? missGrid.join(',') : '无');
    if (missForm.length || missGrid.length) fail++;
    const q = await api('/px/queryFormDataList', { panelCode: pc, pageNo: 1, pageSize: 3 }, token);
    console.log('[%s] query %s total=%s', pc, q.code === 200 ? 'ok' : 'FAIL ' + q.message, q.code === 200 ? q.data.totalSize : '-');
    if (q.code !== 200) fail++;
  }
  // E2E:建单(带一个新字段)→删除
  for (const pc of ['SO_ORDER', 'PU_ORDER']) {
    const n = await api('/px/callButton', { panelCode: pc, buttonName: '提交', formData: {}, buttonParam: {} }, token);
    if (n.code !== 200) { console.log('[新增 %s] FAIL %s', pc, n.message); fail++; continue; }
    const no = n.data['编号'];
    const save = await api('/px/callButton', { panelCode: pc, buttonName: '提交', formData: { 编号: no, 结算期限: '月结30天', ...(pc === 'SO_ORDER' ? { 汇率: 1 } : {}) }, buttonParam: {} }, token);
    console.log('[新增+保存 %s] %s 单号=%s 结算期限保存=%s', pc, save.code === 200 ? 'ok' : 'FAIL ' + save.message, no, save.code === 200 ? (save.data['结算期限'] ?? '(回读略)') : '-');
    if (save.code !== 200) fail++;
    const chk = await api('/px/queryFormDataList', { panelCode: pc, pageNo: 1, pageSize: 1, condition: { 单据编号: no } }, token);
    const row = chk.data?.list?.[0];
    console.log('[回读 %s] %s', pc, row ? `结算期限=${row['结算期限'] ?? '(在明细头)'}` : '(行结构略)');
    const d = await api('/px/callButton', { panelCode: pc, buttonName: '删除', formData: { 编号: no }, buttonParam: {} }, token);
    console.log('[删除 %s] %s', pc, d.code === 200 ? 'ok' : 'FAIL ' + d.message);
    if (d.code !== 200) fail++;
  }
  console.log(fail ? 'RESULT: FAIL' : 'RESULT: ALL PASS');
  if (fail) process.exit(1);
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
