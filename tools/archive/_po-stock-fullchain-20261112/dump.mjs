// 探针(2026-11-12):取四单运行时面板配置,打印「选单映射(头/行)」与「现存量字段注册情况」
// 用途:确认 采购订单→暂收→检验→退回/特采→入库 的 detailMap 是否带 现存量(行映射 14 条上限的坑)
// 用法: node tools/archive/_po-stock-fullchain-20261112/dump.mjs [base]
const base = process.argv[2] || 'http://127.0.0.1:8090';

const login = await (await fetch(`${base}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
if (login.code !== 200) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 200));
const token = login.data.token;

for (const p of ['QC_RECV', 'QC_INSP', 'QC_RETURN', 'QC_TC_IN', 'PURCHASE_IN']) {
  const r = await (await fetch(`${base}/api/px/getPanelConfig?panelCode=${p}`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  const d = r.data || {};
  const meta = d.metadata || {};
  const pages = (meta.panelPageDto && meta.panelPageDto.formPages) || [];
  const formFields = (pages[0] && pages[0].fields) || [];
  const sel = d.selectConfig;
  console.log(`\n=== ${p} ${meta.panelName || ''} ===`);
  const has = formFields.filter((f) => String(f.dataName) === '现存量');
  console.log(`  表单字段 ${formFields.length} 个;含「现存量」: ${has.length ? JSON.stringify(has) : '无'}`);
  if (!sel) { console.log('  无 selectConfig'); continue; }
  console.log(`  选单来源=${sel.source} 表头映射 ${sel.headerMap?.length || 0} 条 / 行映射 ${sel.detailMap?.length || 0} 条`);
  const hh = (sel.headerMap || []).find((m) => m.to === '现存量' || m.from === '现存量');
  const dd = (sel.detailMap || []).find((m) => m.to === '现存量' || m.from === '现存量');
  console.log(`  → 表头映射含现存量: ${hh ? JSON.stringify(hh) : '无'} ; 行映射含现存量: ${dd ? JSON.stringify(dd) : '无'}`);
  console.log(`  行映射全部: ${(sel.detailMap || []).map((m) => m.from + '→' + m.to).join(', ')}`);
}
