/** 面板配置响应结构探查(MANU_ORDER 列表列在哪) */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
(async () => {
  const login = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then((r) => r.json());
  const token = login.data.token;
  const j = await fetch(API + '/px/getPanelConfig?panelCode=MANU_ORDER', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  const d = j.data || {};
  console.log('顶层键: ' + Object.keys(d).join(','));
  const m = d.metadata || {};
  console.log('metadata 键: ' + Object.keys(m).join(','));
  const payload = JSON.stringify(d);
  for (const k of ['合同号', '单据日期', '创建时间', '备注', '领料单号']) {
    console.log(k + ' 出现: ' + payload.includes('"' + k + '"'));
  }
  const find = (o, path) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object' && (x.label || x.dataName))) {
        console.log('列数组 @ ' + path + '.' + k + ' → ' + v.slice(0, 18).map((x) => x.label || x.dataName).join('|'));
      }
      find(v, path + '.' + k);
    }
  };
  find(d, '$');
})();
