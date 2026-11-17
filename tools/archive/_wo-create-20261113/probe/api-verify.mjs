// 2026-11-13 生产工单「新增生产工单（常规/临时）」接口验收探针
// 目标 = 8091 新 jar（指向测试账套 HSDZ_MES_TEST，避免污染正式库）
// 用法: node tools/archive/_wo-create-20261113/probe/api-verify.mjs [baseUrl]
//
// 覆盖：
//   ① /options（客户 + 默认工艺路线）
//   ② /productInfo（产品档案回填）
//   ③ /stdBom（标准组装 BOM 带出）
//   ④ /create 常规工单（不写 wo_bom）
//   ⑤ /create 临时工单（写 wo_bom，至少 1 行）
//   ⑥ 列表下发 工单类型 / 临时物料项数
//   ⑦ /bom（常规=标准BOM；临时=临时工单）
//   ⑧ 手机扫码领料按临时 BOM 展开（BOM来源=临时工单 + 明细备注）
//   ⑨ 工序报工 context 的组装物料 = 临时工单用料
// 退出码 0 = 全 PASS；1 = 有 FAIL（打印逐项结果）。
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const results = []
const ok = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

async function request(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  })
  const txt = await res.text()
  let json
  try { json = JSON.parse(txt) } catch { throw new Error(`${path} HTTP ${res.status} 非 JSON: ${txt.slice(0, 300)}`) }
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${JSON.stringify(json).slice(0, 400)}`)
  return json.data ?? json
}
const post = (p, b, t) => request('POST', p, b, t)
const get = (p, t) => request('GET', p, null, t)

const login = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = login.token
if (!token) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 300))
console.log('login OK, base=' + BASE)

// ① 选项
const options = await post('/api/px/workOrderList/options', {}, token)
const customers = options['客户'] || []
const defaultRoute = String(options['默认工艺路线'] || '')
ok('① options.客户 > 0', customers.length > 0, `客户=${customers.length}`)
ok('① options.默认工艺路线 非空', !!defaultRoute, `默认=${defaultRoute}`)

// ② 产品档案（A-32-01 有标准组装 BOM）
const PROD_STD = 'A-32-01'
const prod = await post('/api/px/workOrderList/productInfo', { 存货编码: PROD_STD }, token)
ok('② productInfo 名称/单位', !!prod['存货名称'] && !!prod['计量单位'], `${prod['存货名称']} / ${prod['计量单位']}`)

// ③ 标准 BOM 带出
const stdBom = await post('/api/px/workOrderList/stdBom', { 产品编码: PROD_STD }, token)
const stdLines = stdBom['行'] || []
ok('③ stdBom 来源=标准BOM 且 行>0', stdBom['来源'] === '标准BOM' && stdLines.length > 0,
  `单号=${stdBom['单据编号']} 行=${stdLines.length}`)

// ④ 常规工单（只填主物料）
const normal = await post('/api/px/workOrderList/create', {
  工单类型: '常规', 产品编码: PROD_STD, 客户编码: customers[0]?.['客户编码'] || '',
  订单数量: 10, 生产数量: 10, 工单日期: new Date().toISOString().slice(0, 10),
  交期: '', 工艺路线: defaultRoute, 备注: '验收探针-常规工单',
}, token)
ok('④ 常规工单已建', !!normal['工单号'] && normal['工单类型'] === '常规',
  `${normal['工单号']} 行id=${normal['行id']} 物料项数=${normal['物料项数']}`)
ok('④ 常规工单不写临时 BOM', Number(normal['物料项数']) === 0)

// ⑤ 临时工单（产品选一个没有标准 BOM 的：A-32-13；子件取 A-32-01 标准 BOM 的前两个子件，保证是有效物料）
const TEMP_PROD = 'A-32-13'
const tempLines = stdLines.slice(0, 2).map((l, i) => ({
  行序: i + 1, 子件编码: l['子件编码'], 子件名称: l['子件名称'], 子件规格: l['子件规格'],
  计量单位: l['计量单位'], 标准用量: l['标准用量'], 损耗量: 0, 行备注: '验收探针',
}))
const temp = await post('/api/px/workOrderList/create', {
  工单类型: '临时', 产品编码: TEMP_PROD, 客户编码: customers[0]?.['客户编码'] || '',
  订单数量: 5, 生产数量: 5, 工单日期: new Date().toISOString().slice(0, 10),
  交期: '', 工艺路线: defaultRoute, 备注: '验收探针-临时工单', 物料清单: tempLines,
}, token)
ok('⑤ 临时工单已建', !!temp['工单号'] && temp['工单类型'] === '临时',
  `${temp['工单号']} 行id=${temp['行id']} 物料项数=${temp['物料项数']}`)
ok('⑤ 临时工单写入 2 行用料', Number(temp['物料项数']) === tempLines.length, `物料项数=${temp['物料项数']}`)

// ⑥ 列表下发 工单类型/临时物料项数
const today = new Date().toISOString().slice(0, 10)
const list = await post('/api/px/workOrderList', {}, token)
const listAll = Array.isArray(list) ? list : []
const normalRow = listAll.find((r) => r['工单号'] === normal['工单号'])
const tempRow = listAll.find((r) => r['工单号'] === temp['工单号'])
ok('⑥ 列表含常规行 工单类型=常规', !!normalRow && normalRow['工单类型'] === '常规',
  normalRow ? `类型=${normalRow['工单类型']} 项数=${normalRow['临时物料项数']}` : '未查到')
ok('⑥ 列表含临时行 工单类型=临时 且 临时物料项数=2', !!tempRow && tempRow['工单类型'] === '临时'
  && Number(tempRow['临时物料项数']) === tempLines.length,
  tempRow ? `类型=${tempRow['工单类型']} 项数=${tempRow['临时物料项数']}` : '未查到')

// ⑦ 物料清单弹窗取数：常规=标准BOM；临时=临时工单
const bomNormal = await post('/api/px/workOrderList/bom', { 行id: normal['行id'] }, token)
ok('⑦ 常规工单 BOM 来源=标准BOM', bomNormal['来源'] === '标准BOM' && (bomNormal['行'] || []).length > 0,
  `来源=${bomNormal['来源']} 单号=${bomNormal['单据编号']} 行=${(bomNormal['行'] || []).length}`)
const bomTemp = await post('/api/px/workOrderList/bom', { 行id: temp['行id'] }, token)
ok('⑦ 临时工单 BOM 来源=临时工单 且 行=2', bomTemp['来源'] === '临时工单' && (bomTemp['行'] || []).length === tempLines.length,
  `来源=${bomTemp['来源']} 行=${(bomTemp['行'] || []).length}`)
ok('⑦ 临时 BOM 行含用量/单位', (bomTemp['行'] || []).every((l) => Number(l['标准用量']) > 0 && !!l['计量单位']),
  JSON.stringify((bomTemp['行'] || [])[0] || {}).slice(0, 160))

// ⑧ 手机扫码领料：临时工单 → 按临时 BOM 展开
let pick = null
try {
  pick = await post('/api/px/mobilePick/generate', { woNo: temp['工单号'], line: 1 }, token)
  ok('⑧ 领料生单 BOM来源=临时工单', pick['BOM来源'] === '临时工单', `BOM来源=${pick['BOM来源']} 物料项数=${pick['物料项数']}`)
  // generate 回执不含明细 → 用单据详情接口取 wo_pick_line(需求数量/明细备注)
  const pickDoc = await get(`/api/px/mobilePick/doc?id=${pick['id']}`, token)
  const pickLines = pickDoc['领料明细'] || []
  const memo = JSON.stringify(pickLines)
  ok('⑧ 领料明细含「临时工单用料」且 2 行',
    pickLines.length === tempLines.length && memo.includes('临时工单用料'),
    `行=${pickLines.length} 备注=${memo.slice(0, 200)}`)
} catch (e) {
  ok('⑧ 领料生单', false, e.message)
}

// ⑨ 工序报工 context 的组装物料 = 临时工单用料
try {
  const ctx = await get(`/api/px/workReport/context?woNo=${encodeURIComponent(temp['工单号'])}&line=1`, token)
  const asm = ctx['组装物料'] || {}
  ok('⑨ 报工 context 组装物料 来源=临时工单 且 行=2',
    asm['来源'] === '临时工单' && (asm['行'] || []).length === tempLines.length,
    `来源=${asm['来源']} 行=${(asm['行'] || []).length} 编号=${asm['BOM编号']}`)
} catch (e) {
  ok('⑨ 报工 context', false, e.message)
}

const failed = results.filter((r) => !r.pass)
console.log(`\n== 汇总 ${results.length - failed.length}/${results.length} PASS ==`)
console.log(JSON.stringify({
  常规工单: normal['工单号'], 常规行id: normal['行id'],
  临时工单: temp['工单号'], 临时行id: temp['行id'],
  清理用: { 常规: normal['工单号'], 临时: temp['工单号'] },
}, null, 1))
process.exit(failed.length ? 1 : 0)
