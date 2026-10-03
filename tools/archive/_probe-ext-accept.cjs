/* 验收补充:①切 en 后动态字段列头显示英文;②doc 面板 place=header 绑定到头表备用列 */
const base = 'http://127.0.0.1:8090'
let pass = 0, fail = 0
const ok = (n, c, e = '') => { (c ? (pass++, console.log('  ok -', n)) : (fail++, console.log('  FAIL -', n, e))) }
async function api(method, path, body, token, lang) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(lang ? { 'Accept-Language': lang } : {}) }, body: body ? JSON.stringify(body) : undefined })
  let j = null; try { j = await res.json() } catch {}
  return { status: res.status, body: j }
}
;(async () => {
  const token = (await api('POST', '/api/auth/login', { userName: 'admin', password: '123456' })).body?.data?.token
  // ① archive 面板 en 验收
  const L1 = 'EXT_英文' + Date.now().toString(36).slice(-4)
  const a1 = await api('POST', '/api/px/extField/add', { panel: 'PARTNER', label: L1, labelEn: 'English Col Test', dataType: '文本', place: 'detail', inQuery: false }, token)
  ok('PARTNER 绑定', a1.status === 200, a1.status + '')
  const cfgEn = await api('GET', '/api/px/getPanelConfig?panelCode=PARTNER', null, token, 'en')
  const flatEn = JSON.stringify(cfgEn.body?.data || {})
  ok('en 配置含英文名', flatEn.includes('English Col Test'), '')
  // ADR-0001:数据键(dataName)永远中文,en 配置含中文键是**预期**;反向断言=zh 配置不应出现英文名
  const cfgZh = await api('GET', '/api/px/getPanelConfig?panelCode=PARTNER', null, token, 'zh-CN')
  ok('zh 配置无英文名(显示层按语言切换)', !JSON.stringify(cfgZh.body?.data || {}).includes('English Col Test'), '')
  // ② doc 面板 header 位(绑到头表备用列)
  const L2 = 'EXT_表头' + Date.now().toString(36).slice(-4)
  const a2 = await api('POST', '/api/px/extField/add', { panel: 'PURCHASE_IN', label: L2, labelEn: 'Header Ext Test', dataType: '文本', place: 'header', inQuery: true }, token)
  ok('PURCHASE_IN 表头位绑定', a2.status === 200 && /^备用\d+$/.test(a2.body?.data?.colName || ''), JSON.stringify(a2.body))
  // 头表备用列在库里真实存在且被登记
  const cfg2 = await api('GET', '/api/px/getPanelConfig?panelCode=PURCHASE_IN', null, token)
  ok('doc 配置含表头字段', JSON.stringify(cfg2.body?.data || {}).includes(L2))
  // 清理
  for (const [p, l] of [['PARTNER', L1], ['PURCHASE_IN', L2]]) {
    const ov = (await api('GET', '/api/px/extFields?panel=' + p, null, token)).body?.data?.fields || []
    const fid = ov.find(f => f.label === l)?.id
    if (fid) { const d = await api('POST', '/api/px/extField/retire', { panel: p, fieldId: fid }, token); ok('清理 ' + p, d.status === 200) }
  }
  console.log(`\n结果: pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error('FATAL', e); process.exit(2) })
