// 分类管理验证:KHDA/GFDA 按钮组与跳转元数据 + 目标分类面板可达
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  let ok = false;
  for (let i = 0; i < 30 && !ok; i++) { await new Promise((r) => setTimeout(r, 2000)); try { await fetch(`${BASE}/base/factory/list`, { signal: AbortSignal.timeout(2000) }); ok = true; } catch {} }
  if (!ok) throw new Error('backend not up');
  const lr = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then((r) => r.json());
  const token = lr.data.token;
  let fail = 0;
  for (const [pc, target, title] of [['KHDA', 'CUSGRP', '客户分类'], ['GFDA', 'SUPGRP', '供应商分类']]) {
    const cfg = await fetch(`${BASE}/px/getPanelConfig?panelCode=${pc}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const m = cfg.data.metadata;
    const groups = (m.buttonGroups || []).map((g) => `${g.name || g.groupName || g.label}:[${(g.actions || g.buttons || []).join(',')}]`);
    const hasBtn = JSON.stringify(groups).includes('分类管理');
    const metaOk = m.classifyPanel === target && m.classifyTitle === title;
    console.log('[%s] 分类管理按钮=%s 元数据=%s(%s/%s)', pc, hasBtn ? '✓' : '✗', metaOk ? '✓' : '✗', m.classifyPanel, m.classifyTitle);
    console.log('  按钮组: %s', groups.join(' | '));
    if (!hasBtn || !metaOk) fail++;
    // 目标面板可达(从按钮跳转的落点)
    const t = await fetch(`${BASE}/px/getPanelConfig?panelCode=${target}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    console.log('  跳转目标 %s: %s', target, t.code === 200 ? '可达' : 'FAIL ' + t.message);
    if (t.code !== 200) fail++;
  }
  // DEPT(无分类档案)不应出现按钮
  const d = await fetch(`${BASE}/px/getPanelConfig?panelCode=DEPT`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const dHas = JSON.stringify(d.data.metadata.buttonGroups).includes('分类管理');
  console.log('[DEPT] 无分类按钮=%s(期望 true=没有)', !dHas);
  if (dHas) fail++;
  console.log(fail ? 'RESULT: FAIL' : 'RESULT: ALL PASS');
  if (fail) process.exit(1);
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
