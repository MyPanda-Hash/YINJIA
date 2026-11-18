const base = process.env.BASE || 'http://127.0.0.1:8091';
const factory = process.env.FACTORY || 'YJ_TEST';
const login = await fetch(base + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory })
}).then(r => r.json());
const token = login.data.token;
const r = await fetch(base + '/api/px/procBom/resync', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: '{}'
});
const j = await r.json();
console.log('resync', r.status, JSON.stringify(j, null, 1));
