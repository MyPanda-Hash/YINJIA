/** 查看 deleteForms 原始响应(为何没删掉探针草稿) */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const NOS = ['MO-2026-09-0095', 'MO-2026-09-0098'];
(async () => {
  const login = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then((r) => r.json());
  const token = login.data.token;
  for (const no of NOS) {
    const res = await fetch(API + '/px/deleteForms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ panelCode: 'MANU_ORDER', rowCodes: [no] }),
    });
    const text = await res.text();
    console.log(no + ' → http=' + res.status + ' body=' + text.slice(0, 300));
  }
})();
