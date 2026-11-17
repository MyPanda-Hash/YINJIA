/* 全局面板冒烟(只读):getPanelConfig + queryFormDataList 逐面板,报告失败(迁移后回归闸)
 * 面板清单来自 DB 导出:.tmp/panel-codes.txt(每行一个 panel_code)
 * 用法: node smoke-panels.mjs [baseUrl]
 * 覆盖两账套(YJ / YJ_TEST)。
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const NL = String.fromCharCode(10)

async function login(factory) {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
  })
  const j = await r.json()
  if (!j?.data?.token) throw new Error('login failed ' + factory + ': ' + JSON.stringify(j).slice(0, 300))
  return { token: j.data.token, user: j.data.user || {} }
}

function api(token) {
  return async (method, path, body) => {
    const r = await fetch(BASE + '/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await r.text()
    let j; try { j = JSON.parse(text) } catch { j = { raw: text.slice(0, 300) } }
    return { http: r.status, j }
  }
}

const fs = await import('node:fs/promises')
const raw = await fs.readFile('D:/workspace/yinjia/.tmp/panel-codes.txt', 'utf8')
const CODES = [...new Set(raw.split(NL).map((s) => s.trim()).filter(Boolean))]

const results = { login: [], panels: [], failures: [] }
for (const factory of ['YJ', 'YJ_TEST']) {
  let lr
  try { lr = await login(factory) } catch (e) { results.login.push({ factory, ok: false, err: e.message }); continue }
  results.login.push({ factory, ok: true, user: lr.user.userName, isAdmin: lr.user.isAdmin, factoryEcho: lr.user.factory })
  const call = api(lr.token)
  results.panels.push({ factory, count: CODES.length })
  for (const code of CODES) {
    const cfg = await call('GET', `/px/getPanelConfig?panelCode=${encodeURIComponent(code)}`)
    if (cfg.http !== 200 || cfg.j?.code !== 200) {
      results.failures.push({ factory, panel: code, step: 'config', http: cfg.http, apiCode: cfg.j?.code, msg: String(cfg.j?.message || '').slice(0, 200) })
      continue
    }
    const q = await call('POST', '/px/queryFormDataList', { panelCode: code, keyword: '', condition: {}, pageNo: 1, pageSize: 5 })
    if (q.http !== 200 || q.j?.code !== 200) {
      results.failures.push({ factory, panel: code, step: 'query', http: q.http, apiCode: q.j?.code, msg: String(q.j?.message || '').slice(0, 200) })
    }
  }
}
console.log(JSON.stringify(results.login, null, 1))
console.log('panels per factory:', JSON.stringify(results.panels))
console.log('failures:', results.failures.length)
for (const f of results.failures.slice(0, 40)) console.log('  -', JSON.stringify(f))
process.exit(results.failures.length ? 1 : 0)
