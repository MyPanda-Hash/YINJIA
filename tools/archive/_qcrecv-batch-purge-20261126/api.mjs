// 生产 API 小客户端（本机 → http://36.140.66.163:8090）。只做登录 + 通用 POST/GET。
const BASE = process.env.YJ_BASE || 'http://36.140.66.163:8090';
let token = null;
let factory = 'YJ';

export async function login(userName = 'admin', password = '123456') {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password }),
  });
  const j = await r.json();
  if (j.code !== 200) throw new Error('login failed: ' + JSON.stringify(j).slice(0, 300));
  token = j.data.token;
  factory = j.data.user.factory;
  return { token, factory, user: j.data.user.userName };
}

async function fetchRetry(url, init, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fetch(url, init); }
    catch (e) { last = e; await new Promise(r => setTimeout(r, 600 * (i + 1))); }
  }
  throw last;
}

async function req(method, path, body) {
  if (!token) await login();
  const r = await fetchRetry(BASE + '/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      ...(body && body.__db ? { 'X-Factory': body.__db } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); } catch { throw new Error(`non-json ${r.status}: ${text.slice(0, 300)}`); }
  return { status: r.status, body: j };
}

export const post = (p, b) => req('POST', p, b);
export const get = (p) => req('GET', p);

export async function queryPanel(panelCode, { condition = {}, keyword = '', pageNo = 1, pageSize = 500, countOnly = false } = {}) {
  const r = await post('/px/queryFormDataList', { panelCode, condition, keyword, pageNo, pageSize, countOnly });
  if (r.body.code !== 200) throw new Error(panelCode + ' query: ' + JSON.stringify(r.body).slice(0, 400));
  return r.body.data;
}
