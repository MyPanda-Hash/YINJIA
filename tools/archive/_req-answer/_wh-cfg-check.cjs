// _wh-cfg-check.cjs — 验证 WH 面板配置里 库位 字段(zh/en 两种 locale)
const BASE = 'http://127.0.0.1:8090';
(async () => {
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then(r => r.json());
  const tok = login.data.token;
  for (const locale of ['zh-CN', 'en', 'ja']) {
    const cfg = await fetch(BASE + '/api/px/getPanelConfig?panelCode=WH', {
      headers: { Authorization: 'Bearer ' + tok, 'Accept-Language': locale },
    }).then(r => r.json());
    const tab = cfg.data.detail.tabs[0];
    const fields = tab.fields.map(f => f.dataName);
    const loc = tab.fields.find(f => f.dataName === '库位');
    console.log(`[${locale}] tab=${tab.label}`);
    console.log(`  fields(${fields.length})=` + fields.join(','));
    if (loc) {
      console.log(`  库位 -> dataType=${loc.dataType} width=${loc.width} isRequired=${loc.isRequired}`);
      // 找列头显示名(表格式列定义)
      const gridCols = (cfg.data.metadata || []);
    } else {
      console.log('  !! 库位 字段缺失');
    }
    // grid 列顺序(表头列定义一般在 dataSchema 或 metadata)
    const grid = cfg.data.dataSchema;
    if (locale === 'en') {
      console.log('  en tab label(应译): ' + tab.label);
    }
  }
  // 列头显示:gridTabs/columnAliases 也看一眼
  const cfg = await fetch(BASE + '/api/px/getPanelConfig?panelCode=WH', {
    headers: { Authorization: 'Bearer ' + tok, 'Accept-Language': 'en' },
  }).then(r => r.json());
  const meta = cfg.data.metadata;
  console.log('metadata keys: ' + Object.keys(meta || {}).join(','));
  console.log('columnAliases(en): ' + JSON.stringify(meta.columnAliases));
})().catch(e => { console.error('FAIL', e); process.exit(1); });
