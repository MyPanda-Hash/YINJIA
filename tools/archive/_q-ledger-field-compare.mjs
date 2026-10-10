/**
 * _q-ledger-field-compare.mjs — 两账套「运行时字段与顺序」对比(采购链四单)
 *
 * 为什么:库侧(yj_field)对齐 ≠ 界面字段顺序对齐 —— 界面顺序由后端 getPanelConfig 下发。
 * 本脚本分别用**正式账套**与**测试账套**登录(登录工厂不同 ⇒ 后端切库),取四单的
 * 表单字段 / 查询区字段 / 列表列 / 明细页签字段顺序,逐段对比。
 *
 * 用法: node tools/archive/_q-ledger-field-compare.mjs [http://127.0.0.1:8090]
 */
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'
const PANELS = ['QC_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN']

const post = async (p, body, token) => (await fetch(BASE + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body),
})).json()
const get = async (p, token) => (await fetch(BASE + p, { headers: { Authorization: 'Bearer ' + token } })).json()

// ① 工厂列表:找测试账套的 factory 码
const facs = await get('/base/factory/list')
const list = facs?.data || facs || []
console.log('登录工厂:', JSON.stringify(list.map((f) => ({ code: f.code, name: f.name }))))
const testFac = list.find((f) => /测试/.test(f.name || '') || /TEST/i.test(f.code || ''))
if (!testFac) { console.error('没找到测试账套工厂'); process.exit(1) }

/** 取一个账套下四单的字段顺序快照 */
async function snapshot(factory) {
  const login = await post('/auth/login', { userName: 'admin', password: '123456', ...(factory ? { factory } : {}) })
  if (login?.code !== 200) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 200))
  const token = login.data.token
  const out = {}
  for (const p of PANELS) {
    const cfg = await get(`/px/getPanelConfig?panelCode=${p}`, token)
    const md = cfg?.data?.metadata || {}
    const tp = md.panelPageDto?.tablePages?.[0] || {}
    const fp = (md.panelPageDto?.formPages || [])[0] || {}
    const tabs = cfg?.data?.detail?.tabs || []
    out[p] = {
      form: (fp.fields || []).map((f) => f.dataName),
      query: (tp.queryFields || []).map((f) => f.dataName),
      grid: ((tp.gridTabs || [])[0]?.columns || []).map((c) => c.dataName || c.label),
      detail: tabs.flatMap((t) => (t.fields || []).map((f) => `${t.key}/${f.dataName}`)),
    }
  }
  return out
}

const prod = await snapshot(null)
const test = await snapshot(testFac.code)

let diffs = 0
for (const p of PANELS) {
  for (const seg of ['form', 'query', 'grid', 'detail']) {
    const a = prod[p][seg], b = test[p][seg]
    const same = a.length === b.length && a.every((v, i) => v === b[i])
    if (!same) {
      diffs++
      console.log(`[差异] ${p}.${seg}  正式 ${a.length} 项 / 测试 ${b.length} 项`)
      const n = Math.max(a.length, b.length)
      for (let i = 0; i < n; i++) {
        if (a[i] !== b[i]) console.log(`        第 ${i + 1} 项: 正式='${a[i] ?? ''}' 测试='${b[i] ?? ''}'`)
      }
    }
  }
}
console.log(`\n四单 × 4 段(表单/查询/列表列/明细)共 ${PANELS.length * 4} 段对比完毕`)
console.log('RESULT: ' + (diffs === 0 ? 'IDENTICAL' : 'DIFF-' + diffs))
process.exit(diffs === 0 ? 0 : 1)
