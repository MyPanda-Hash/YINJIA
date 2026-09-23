// 验证:台账/状况表弹窗「选仓库后,存货参照候选收窄」——复刻 business/engine.js 的 queryRefRows:
//   queryFormDataList(refPanel) → singleDoc 展平 detail[tab] → keyword → 数组型 filter 逐行 every
// 用法: node tools/archive/_verify-item-narrow.mjs
const BASE = 'http://localhost:8090/api'
let token = ''

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const j = await res.json()
  if (!res.ok || (j.code !== undefined && j.code !== 0 && j.code !== 200)) throw new Error(path + ' ' + JSON.stringify(j).slice(0, 200))
  return j.data ?? j
}
async function get(path) {
  const res = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token } })
  const j = await res.json()
  return j.data ?? j
}

/** 复刻 queryRefRows(INV, ...) 的取数路径 */
async function refRowsINV({ keyword = '', filter = {} } = {}) {
  const cfg = await get('/px/getPanelConfig?panelCode=INV')
  const singleDoc = cfg?.metadata?.singleDoc === true
  const hasAlternativeFilter = Object.values(filter).some(Array.isArray)
  const cond = singleDoc || hasAlternativeFilter ? {} : { ...filter }
  const res = await post('/px/queryFormDataList', { panelCode: 'INV', condition: cond, keyword: singleDoc ? '' : keyword, pageNo: 1, pageSize: 200 })
  let list = res.list || []
  if (singleDoc && list.some((r) => r?.detail)) {
    const tabKey = cfg?.detail?.tabs?.[0]?.key || 'items'
    list = list.flatMap((doc) => (doc?.detail?.[tabKey] || []).map((row) => ({ 所属类别: doc['类别'] || '', ...row })))
    if (keyword) {
      const k = String(keyword).toLowerCase()
      list = list.filter((row) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(k)))
    }
  }
  if (Object.keys(filter).length) {
    list = list.filter((row) => Object.entries(filter).every(([key, expected]) => {
      const candidates = Array.isArray(expected) ? expected : [expected]
      return candidates.some((value) => String(row[key]) === String(value))
    }))
  }
  return { singleDoc, totalSize: res.totalSize, rows: list }
}

let fail = 0
const check = (label, ok, detail = '') => { console.log(`${ok ? '  OK  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`); if (!ok) fail++ }

token = (await post('/auth/login', { userName: 'admin', password: '123456' })).token

// 存货档案规模(未收窄)
const all = await refRowsINV()
console.log(`\n存货参照(未收窄):singleDoc=${all.singleDoc} totalSize=${all.totalSize} 弹窗候选=${all.rows.length}`)
check('未选仓库时不收窄:候选=整份存货档案', all.rows.length === all.totalSize && all.rows.length > 3000, `${all.rows.length} 行`)

// 收窄到「华北工控仓 有流水的存货」(联动选项返回的那两个)
const wh = '华北工控仓'
const link = await post('/px/callButton', { panelCode: 'STOCK_LEDGER', buttonName: '台账联动选项', formData: { 仓库: wh }, buttonParam: {} })
const names = link['存货列表']
console.log(`\n选 仓库=${wh} → 联动选项 存货列表=${JSON.stringify(names)}`)
const narrowed = await refRowsINV({ filter: { 存货名称: names } })
const narrowedNames = [...new Set(narrowed.rows.map((r) => String(r['存货名称'])))]
check('收窄生效:候选只剩清单内的存货名(同名的多个规格行都留着)',
  narrowed.rows.length > 0 && narrowed.rows.length < all.rows.length
  && narrowedNames.every((n) => names.includes(n)) && narrowedNames.length === names.length,
  `弹窗候选 ${all.rows.length} → ${narrowed.rows.length} 行,名称=${JSON.stringify(narrowedNames)}`)
check('收窄后仍是档案行(带回 存货编码/规格型号,与未收窄同源)',
  narrowed.rows.every((r) => r['存货编码'] !== undefined), JSON.stringify(narrowed.rows[0] || {}).slice(0, 120))

// 收窄后的每一项都真能查出数据(不再出现空数据)
for (const name of names) {
  const r = await post('/px/queryFormDataList', {
    panelCode: 'STOCK_LEDGER',
    condition: { 仓库: wh, 存货: name, 开始日期: '2020-01-01', 结束日期: '2030-12-31' },
    pageNo: 1, pageSize: 50,
  })
  const detail = (r.list || []).filter((x) => !['期初结存', '期末结存'].includes(x['单据类型']))
  const hasEnds = (r.list || []).some((x) => x['单据类型'] === '期初结存')
  check(`收窄后的「${name}」查询有数据`, detail.length > 0 && hasEnds, `明细 ${detail.length} 行 + 期初/期末, totalSize=${r.totalSize}`)
}

// 反例:档案里但该仓无流水的存货仍在档案中,只是被候选清单挡掉 → 收窄的是候选,不是档案
// (台账号里有 138/235 行的存货本就不在 bs_inv,所以取一个「档案里确实有、但不在流水清单里」的名字)
const outsideName = all.rows.map((r) => String(r['存货名称'])).find((n) => n && !names.includes(n))
const outside = await refRowsINV({ filter: { 存货名称: [outsideName] } })
check(`档案里的其它存货仍在(如「${outsideName}」),只是选不到`,
  outside.rows.length > 0 && !narrowedNames.includes(outsideName), `档案命中 ${outside.rows.length} 行`)

console.log(`\n${fail === 0 ? '全部通过' : fail + ' 项未通过'}`)
process.exit(fail === 0 ? 0 : 1)
