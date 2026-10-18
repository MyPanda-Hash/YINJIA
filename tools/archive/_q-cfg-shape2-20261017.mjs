/** _q-cfg-shape2-20261017.mjs — 字段对象的键形状 + 备用列在配置里的位置(只读) */
const BASE = 'http://127.0.0.1:8090';
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json());
const T = { Authorization: 'Bearer ' + login.data.token };
const cfg = async (p) => (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${p}`, { headers: T }).then((r) => r.json())).data;

for (const panel of ['QC_PROC_INSP', 'QC_INSP_REQ_SERIES']) {
  const d = await cfg(panel);
  const f = d.dataSchema?.fields || [];
  console.log(`\n===== ${panel}: dataSchema.fields = ${f.length}`);
  if (f.length) console.log('  样本字段对象:', JSON.stringify(f[0]));
  console.log('  字段名清单:', f.map((x) => x.dataName || x.label || x.colName || x.name || Object.values(x)[0]).join(' | ').slice(0, 400));
  const tabs = d.detail?.tabs || [];
  console.log(`  detail.tabs = ${tabs.length}`);
  for (const t of tabs.slice(0, 3)) {
    console.log(`    tab ${JSON.stringify(t.tabKey ?? t.key ?? t.name)}: 键=${Object.keys(t).join(',')} fields=${(t.fields || []).length}`);
    if ((t.fields || []).length) console.log('      样本:', JSON.stringify(t.fields[0]).slice(0, 200));
  }
  const allKeys = new Set();
  const walk = (o, path) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.slice(0, 2).forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    for (const k of Object.keys(o)) { allKeys.add(`${path}.${k}`); walk(o[k], `${path}.${k}`); }
  };
  walk(d, 'data');
  console.log('  所有路径(前 30):', [...allKeys].slice(0, 30).join(' '));
}
