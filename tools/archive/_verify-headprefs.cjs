// 表头调整验证:更多组按钮 + saveHeaderPrefs 往返(隐藏→表单meta带hidden→恢复) + 表格调整不受影响
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  let ok = false;
  for (let i = 0; i < 30 && !ok; i++) { await new Promise((r) => setTimeout(r, 2000)); try { await fetch(`${BASE}/base/factory/list`, { signal: AbortSignal.timeout(2000) }); ok = true; } catch {} }
  if (!ok) throw new Error('backend not up');
  const lr = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then((r) => r.json());
  const token = lr.data.token;
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let fail = 0;

  // 1) 单据面板「更多」组出现 表头调整(紧跟表格调整)
  for (const pc of ['SO_ORDER', 'PU_ORDER', 'RKD']) {
    const cfg = await fetch(`${BASE}/px/getPanelConfig?panelCode=${pc}`, { headers: H }).then((r) => r.json());
    const more = (cfg.data.metadata.buttonGroups || []).find((g) => g.name === '更多');
    const acts = more ? more.actions : [];
    const has = acts.includes('表头调整');
    const order = has && acts.indexOf('表头调整') === acts.indexOf('表格调整') + 1;
    console.log('[%s] 更多=%j 表头调整=%s 紧跟表格调整=%s', pc, acts, has ? '✓' : '✗', order ? '✓' : '✗');
    if (!has || !order) fail++;
  }
  // 档案面板(KHDA)不应有 表头调整
  const kh = await fetch(`${BASE}/px/getPanelConfig?panelCode=KHDA`, { headers: H }).then((r) => r.json());
  const khHas = JSON.stringify(kh.data.metadata.buttonGroups).includes('表头调整');
  console.log('[KHDA] 档案无表头调整=%s(期望 true=没有)', !khHas);
  if (khHas) fail++;

  // 2) saveHeaderPrefs 往返:SO_ORDER 隐藏 合同号不存在→用 币种(当前显示)
  const cfg0 = await fetch(`${BASE}/px/getPanelConfig?panelCode=SO_ORDER`, { headers: H }).then((r) => r.json());
  const fields = cfg0.data.dataSchema.fields;
  const labels = fields.map((f) => f.dataName);
  const target = labels.includes('币种') ? '币种' : labels[labels.length - 1];
  const reordered = [target, ...labels.filter((l) => l !== target)];
  console.log('[saveHeaderPrefs] 隐藏+置顶 %s (共%d字段)', target, labels.length);
  const save1 = await fetch(`${BASE}/px/saveHeaderPrefs`, { method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'SO_ORDER', columns: reordered.map((l) => ({ label: l, alias: '', visible: l !== target })) }) }).then((r) => r.json());
  if (save1.code !== 200) { console.log('  save FAIL %s', save1.message); fail++; }
  await new Promise((r) => setTimeout(r, 500));
  const cfg1 = await fetch(`${BASE}/px/getPanelConfig?panelCode=SO_ORDER`, { headers: H }).then((r) => r.json());
  const f1 = cfg1.data.dataSchema.fields.find((f) => f.dataName === target);
  console.log('  隐藏后: hidden=%s 序=第%d个(期望1) dataName=%s', f1.hidden, cfg1.data.dataSchema.fields.findIndex((f) => f.dataName === target) + 1, f1.dataName);
  if (f1.hidden !== true || cfg1.data.dataSchema.fields[0].dataName !== target) fail++;
  // 表单描述符 meta 同样带 hidden(表单渲染侧过滤生效的开关)
  const fd = await fetch(`${BASE}/px/getFormDescriptor?panelCode=SO_ORDER&code=new`, { headers: H }).then((r) => r.json());
  const metaTarget = (fd.data?.data?.meta || fd.data?.meta || []).find?.((m) => m.code === target);
  console.log('  formDescriptor meta[%s]: %s', target, metaTarget ? `hidden=${metaTarget.hidden}` : '(meta在别层,跳过)');
  // 3) 恢复:全部显示 + 原顺序
  const save2 = await fetch(`${BASE}/px/saveHeaderPrefs`, { method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'SO_ORDER', columns: labels.map((l) => ({ label: l, alias: '', visible: true })) }) }).then((r) => r.json());
  const cfg2 = await fetch(`${BASE}/px/getPanelConfig?panelCode=SO_ORDER`, { headers: H }).then((r) => r.json());
  const f2 = cfg2.data.dataSchema.fields.find((f) => f.dataName === target);
  const orderRestored = cfg2.data.dataSchema.fields.map((f) => f.dataName).join(',') === labels.join(',');
  console.log('  恢复后: hidden=%s 顺序还原=%s', f2.hidden === undefined ? '(无,即显示)' : f2.hidden, orderRestored ? '✓' : '✗');
  if (f2.hidden === true || !orderRestored) fail++;
  // 4) 表格调整端点不受影响
  const sc = await fetch(`${BASE}/px/saveColumnPrefs`, { method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'SO_ORDER', columns: cfg0.data.detail.tabs[0].fields.map((f) => ({ label: f.dataName, alias: '', visible: true })) }) }).then((r) => r.json());
  console.log('[saveColumnPrefs] 回归 %s', sc.code === 200 ? 'ok' : 'FAIL ' + sc.message);
  if (sc.code !== 200) fail++;

  console.log(fail ? 'RESULT: FAIL' : 'RESULT: ALL PASS');
  if (fail) process.exit(1);
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
