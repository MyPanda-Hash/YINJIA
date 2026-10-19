/** 探测某实例上有哪些面板可用(逐个 try getPanelConfig),用于分辨"服务器跑的是哪一版元数据"。
 *  用法:node _remote-panels.mjs [host:port] code1 code2 ...
 */
const host = process.argv[2] || '36.140.66.163:8090';
const codes = process.argv.slice(3);
const API = `http://${host}/api`;
const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const H = { Authorization: 'Bearer ' + login.data.token };
for (const c of codes) {
  const r = await fetch(`${API}/px/getPanelConfig?panelCode=${c}`, { headers: H });
  let name = '';
  if (r.ok) {
    const j = await r.json().catch(() => ({}));
    name = j?.data?.panelName || j?.data?.name || '';
  }
  console.log(`${c.padEnd(18)} HTTP ${r.status} ${name}`);
}
