// formPages 里找头字段
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const lr = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then((r) => r.json());
  const token = lr.data.token;
  for (const pc of ['SO_ORDER', 'PU_ORDER']) {
    const cfg = await fetch(`${BASE}/px/getPanelConfig?panelCode=${pc}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const m = cfg.data.metadata;
    const fp = m.formPages?.[0];
    if (!fp) { console.log('[%s] 无 formPages', pc); continue; }
    const names = String(fp.fieldNames || '').split(',').filter(Boolean);
    const expect = pc === 'SO_ORDER' ? ['币种', '汇率', '结算期限', '备注', '部门负责人'] : ['供应商编码', '结算期限'];
    const missing = expect.filter((k) => !names.includes(k));
    console.log('[%s] formPages[0].fieldNames(%d个) 缺失=%s', pc, names.length, missing.length ? missing.join(',') : '无(全到位)');
    console.log('  字段: %s', names.join(','));
  }
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
