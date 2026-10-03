// 退绑残留取证:绑定→查库→退绑→查库→看配置哪里还含标签
const base = 'http://127.0.0.1:8090'
const LABEL = 'EXT_取证' + Date.now().toString(36).slice(-4)
async function api(method, path, body, token) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })
  let j = null; try { j = await res.json() } catch {}
  return { status: res.status, body: j }
}
;(async () => {
  const login = await api('POST', '/api/auth/login', { userName: 'admin', password: '123456' })
  const token = login.body?.data?.token
  const add = await api('POST', '/api/px/extField/add', { panel: 'PARTNER', label: LABEL, labelEn: 'Dbg', dataType: '文本', place: 'detail', inQuery: true }, token)
  console.log('add:', add.status, JSON.stringify(add.body?.data))
  let ov = await api('GET', '/api/px/extFields?panel=PARTNER', null, token)
  const fid = ov.body?.data?.fields.find(f => f.label === LABEL)?.id
  console.log('fid:', fid)
  const ret = await api('POST', '/api/px/extField/retire', { panel: 'PARTNER', fieldId: fid }, token)
  console.log('retire:', ret.status, JSON.stringify(ret.body))
  ov = await api('GET', '/api/px/extFields?panel=PARTNER', null, token)
  console.log('fields after retire:', JSON.stringify(ov.body?.data?.fields.map(f => f.label)))
  const cfg = await api('GET', '/api/px/getPanelConfig?panelCode=PARTNER', null, token)
  const flat = JSON.stringify(cfg.body?.data || {})
  console.log('config contains label:', flat.includes(LABEL))
  // 定位标签出现在配置的哪个路径
  const find = (o, path) => {
    if (o == null) return
    if (typeof o === 'string') { if (o.includes(LABEL)) console.log('  hit @', path); return }
    if (Array.isArray(o)) { o.forEach((v, i) => find(v, path + '[' + i + ']')); return }
    if (typeof o === 'object') { for (const [k, v] of Object.entries(o)) find(v, path + '.' + k) }
  }
  find(cfg.body?.data, '$')
})().catch(e => { console.error('FATAL', e); process.exit(2) })
