// _restore-testlib.cjs — 还原探针污染的 spec.test 首条(上一轮探针整段替换了 req)
const fs = require('node:fs'); const path = require('node:path')
const BASE = 'http://localhost:8090'
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  const api = async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })).json()
  const src = fs.readFileSync(path.join(__dirname, '../frontend/src/core/views/specTestLib.js'), 'utf8')
    .replace(/^import[^\n]*$/gm, '').replace(/^export\s+/gm, '')
  const { SPEC_TEST_LIB } = new Function(src + '\nreturn {SPEC_TEST_LIB}')()
  const orig = SPEC_TEST_LIB[0].subs[0]
  const res = await api('/api/stdlib/list?lib=spec.test&all=1')
  const dirty = (res.data || []).filter((r) => String(r.content || '').includes('维护探针'))
  for (const row of dirty) {
    const c = JSON.parse(row.content)
    if (c.group === SPEC_TEST_LIB[0].name && (c.name || '') === (orig.name || '')) {
      c.req = orig.req
      console.log('restored', row.id, c.group, c.name || '(空)')
    } else {
      c.req = String(c.req || '').replace(/【维护探针\d+】/g, '')
      console.log('stripped', row.id, c.group, c.name || '(空)')
    }
    await api('/api/stdlib/update', { method: 'POST', body: JSON.stringify({ id: row.id, content: JSON.stringify(c) }) })
  }
  console.log('dirty rows:', dirty.length)
}
main().catch((e) => { console.error(e); process.exit(1) })
