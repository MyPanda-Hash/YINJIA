// _wh-cfg-check2.cjs — 验证 WH 面板 en 网格列头 columnAliases 含 库位 译名
const BASE = 'http://127.0.0.1:8090';
(async () => {
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then(r => r.json());
  const tok = login.data.token;
  for (const locale of ['zh-CN', 'en', 'ja', 'de']) {
    const cfg = await fetch(BASE + '/api/px/getPanelConfig?panelCode=WH', {
      headers: { Authorization: 'Bearer ' + tok, 'Accept-Language': locale },
    }).then(r => r.json());
    const d = cfg.data;
    const tab = d.detail.tabs[0];
    const f = tab.fields.find(x => x.dataName === '库位');
    const disp = f && f.displayName ? f.displayName : '(无 displayName=中文)';
    const grids = (d.gridTabs || d.metadata?.gridTabs || []);
    const aliases = grids.map(g => g.columnAliases || null).filter(Boolean)[0] || d.columnAliases || null;
    console.log(`[${locale}] 库位 displayName=${disp}`);
    if (aliases) console.log(`  columnAliases.库位 = ${aliases['库位']}`);
    else console.log('  (无 columnAliases)');
  }
})().catch(e => { console.error('FAIL', e); process.exit(1); });
