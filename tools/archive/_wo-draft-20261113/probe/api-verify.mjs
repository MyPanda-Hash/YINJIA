// 2026-11-13 方案 A：生产工单「保存草稿 + 草稿箱 + 提交生成正式工单」接口验收探针
// 目标 = 8091 新 jar（指向测试账套 HSDZ_MES_TEST）；用法: node .../api-verify.mjs [baseUrl]
// 覆盖：draft/save(新建/覆盖) → draft/list → draft/get → draft/count → draft/submit(常规/临时)
//       → 正式工单可查 → draft/delete → 草稿校验(缺主物料/缺路线提交)报错
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const results = []
const ok = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}
async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  })
  const txt = await res.text()
  let json
  try { json = JSON.parse(txt) } catch { throw new Error(`${path} HTTP ${res.status} 非 JSON: ${txt.slice(0, 300)}`) }
  return { http: res.status, code: json.code, message: json.message, data: json.data }
}
const post = (p, b, t) => call('POST', p, b, t)

const login = (await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })).data
const token = login.token
if (!token) throw new Error('登录失败')
console.log('login OK, base=' + BASE)

const options = (await post('/api/px/workOrderList/options', {}, token)).data
const route = options['默认工艺路线']
// 测试账套有编码为空的脏客户行 ⇒ 取第一个编码非空的(与下拉可选项一致)
const customer = (options['客户'] || []).find((c) => String(c['客户编码'] || '').trim() !== '') || {}
ok('① options 默认工艺路线/客户可用', !!route && !!customer['客户编码'], `route=${route} 客户=${customer['客户编码']} 客户数=${(options['客户'] || []).length}`)

// ② 新建草稿（只填主物料+数量，草稿宽松校验）
const r1 = await post('/api/px/workOrderList/draft/save', {
  草稿id: 0, 工单类型: '常规', 产品编码: 'A-32-01',
  订单数量: 10, 生产数量: 10, 工单日期: new Date().toISOString().slice(0, 10),
  备注: '验收探针-草稿-常规',
}, token)
const d1 = r1.data || {}
ok('② 新建草稿成功(草稿号 GDD-)', r1.code === 200 && String(d1['草稿号'] || '').startsWith('GDD-'), `code=${r1.code} 草稿号=${d1['草稿号']} id=${d1['草稿id']}`)
ok('② 新建草稿不落 plang', r1.code === 200 && !d1['工单号'])

// ③ 草稿箱列表能看到
const list1 = (await post('/api/px/workOrderList/draft/list', {}, token)).data || []
const hit1 = list1.find((x) => String(x['草稿id']) === String(d1['草稿id']))
ok('③ 草稿箱列表含该草稿', !!hit1, `列表=${list1.length} 行; 产品=${hit1?.['产品编码']} 类型=${hit1?.['工单类型']}`)

// ④ 读草稿详情
const g1 = (await post('/api/px/workOrderList/draft/get', { 草稿id: d1['草稿id'] }, token)).data || {}
ok('④ 读草稿详情(表头+空物料)', g1['草稿号'] === d1['草稿号'] && (g1['物料清单'] || []).length === 0,
  `状态=${g1['状态']} 物料=${(g1['物料清单'] || []).length}`)

// ⑤ 覆盖保存（补路线/客户/交期）
const r2 = await post('/api/px/workOrderList/draft/save', {
  草稿id: d1['草稿id'], 工单类型: '常规', 产品编码: 'A-32-01',
  客户编码: customer['客户编码'], 订单数量: 12, 生产数量: 12,
  工单日期: new Date().toISOString().slice(0, 10), 交期: '', 工艺路线: route,
  备注: '验收探针-草稿-常规',
}, token)
ok('⑤ 覆盖保存同一草稿', r2.code === 200 && String(r2.data?.['草稿号']) === String(d1['草稿号']) && String(r2.data?.['草稿id']) === String(d1['草稿id']))
const g2 = (await post('/api/px/workOrderList/draft/get', { 草稿id: d1['草稿id'] }, token)).data || {}
ok('⑤ 覆盖后路线/客户/数量生效', g2['工艺路线'] === route && Number(g2['订单数量']) === 12 && String(g2['客户编码']) === String(customer['客户编码']),
  `路线=${g2['工艺路线']} 订单数量=${g2['订单数量']} 客户=${g2['客户编码']}`)

// ⑥ 角标数量
const c1 = (await post('/api/px/workOrderList/draft/count', {}, token)).data || {}
ok('⑥ 草稿角标数量>=1', Number(c1['数量']) >= 1, `数量=${c1['数量']}`)

// ⑦ 提交 → 正式工单
const s1 = await post('/api/px/workOrderList/draft/submit', { 草稿id: d1['草稿id'] }, token)
const plNo1 = s1.data?.['工单号'] || ''
ok('⑦ 提交草稿生成正式工单', s1.code === 200 && String(plNo1).startsWith('GD-'), `code=${s1.code} 工单号=${plNo1} 草稿号=${s1.data?.['草稿号']}`)
const g3 = (await post('/api/px/workOrderList/draft/get', { 草稿id: d1['草稿id'] }, token))
ok('⑦ 提交后草稿不可再读(已提交)', g3.code !== 200, `code=${g3.code} message=${g3.message}`)
// 正式工单在列表可查 + 常规类型
const listPl = (await post('/api/px/workOrderList', { keyword: plNo1 }, token)).data || []
const rowPl = listPl.find((r) => r['工单号'] === plNo1)
ok('⑦ 正式工单已进生产工单列表(常规)', !!rowPl && rowPl['工单类型'] === '常规',
  rowPl ? `${rowPl['工单号']} 需求=${rowPl['需求数量']} 类型=${rowPl['工单类型']}` : '未查到')

// ⑧ 临时工单草稿（从标准 BOM 带 2 行）→ 提交 → 临时类型 + wo_bom
const std = (await post('/api/px/workOrderList/stdBom', { 产品编码: 'A-32-01' }, token)).data || {}
const lines = (std['行'] || []).slice(0, 2).map((l, i) => ({
  行序: i + 1, 子件编码: l['子件编码'], 子件名称: l['子件名称'], 子件规格: l['子件规格'],
  计量单位: l['计量单位'], 标准用量: l['标准用量'], 损耗量: 0, 行备注: '验收探针',
}))
const r3 = await post('/api/px/workOrderList/draft/save', {
  草稿id: 0, 工单类型: '临时', 产品编码: 'A-32-13',
  客户编码: customer['客户编码'], 订单数量: 5, 生产数量: 5,
  工单日期: new Date().toISOString().slice(0, 10), 工艺路线: route,
  备注: '验收探针-草稿-临时', 物料清单: lines,
}, token)
const d3 = r3.data || {}
ok('⑧ 临时工单草稿保存(2 行用料)', r3.code === 200 && Number(d3['物料项数']) === 2, `草稿号=${d3['草稿号']} 物料项数=${d3['物料项数']}`)
const g4 = (await post('/api/px/workOrderList/draft/get', { 草稿id: d3['草稿id'] }, token)).data || {}
ok('⑧ 草稿详情读回 2 行用料', (g4['物料清单'] || []).length === 2, JSON.stringify((g4['物料清单'] || [])[0] || {}).slice(0, 160))
const s2 = await post('/api/px/workOrderList/draft/submit', { 草稿id: d3['草稿id'] }, token)
const plNo2 = s2.data?.['工单号'] || ''
ok('⑧ 临时草稿提交生成正式工单', s2.code === 200 && String(plNo2).startsWith('GD-'), `工单号=${plNo2}`)
const listPl2 = (await post('/api/px/workOrderList', { keyword: plNo2 }, token)).data || []
const rowPl2 = listPl2.find((r) => r['工单号'] === plNo2)
ok('⑧ 正式临时工单 工单类型=临时 且 临时物料项数=2', !!rowPl2 && rowPl2['工单类型'] === '临时' && Number(rowPl2['临时物料项数']) === 2,
  rowPl2 ? `类型=${rowPl2['工单类型']} 项数=${rowPl2['临时物料项数']}` : '未查到')
const bom2 = (await post('/api/px/workOrderList/bom', { 行id: rowPl2?.['行id'] }, token)).data || {}
ok('⑧ 正式临时工单 BOM 来源=临时工单 且 2 行', bom2['来源'] === '临时工单' && (bom2['行'] || []).length === 2,
  `来源=${bom2['来源']} 行=${(bom2['行'] || []).length}`)

// ⑨ 删除草稿
const r4 = await post('/api/px/workOrderList/draft/save', { 草稿id: 0, 工单类型: '常规', 产品编码: 'A-32-01', 订单数量: 1, 备注: '验收探针-待删除' }, token)
const d4 = r4.data || {}
const del = await post('/api/px/workOrderList/draft/delete', { 草稿id: d4['草稿id'] }, token)
ok('⑨ 删除草稿成功', del.code === 200 && String(del.data?.['草稿号']) === String(d4['草稿号']), `code=${del.code} 草稿号=${d4['草稿号']}`)
const g5 = await post('/api/px/workOrderList/draft/get', { 草稿id: d4['草稿id'] }, token)
ok('⑨ 删除后读不到', g5.code !== 200, `code=${g5.code} message=${g5.message}`)

// ⑩ 草稿校验：缺主物料保存 → 报错；缺路线提交 → 报错且草稿保持草稿态
const bad1 = await post('/api/px/workOrderList/draft/save', { 草稿id: 0, 工单类型: '常规', 订单数量: 1 }, token)
ok('⑩ 缺主物料保存草稿被拦截', bad1.code !== 200 && String(bad1.message || '').includes('主物料'), `code=${bad1.code} message=${bad1.message}`)
const r5 = await post('/api/px/workOrderList/draft/save', { 草稿id: 0, 工单类型: '常规', 产品编码: 'A-32-01', 订单数量: 2, 备注: '验收探针-缺路线' }, token)
const d5 = r5.data || {}
const bad2 = await post('/api/px/workOrderList/draft/submit', { 草稿id: d5['草稿id'] }, token)
const g6 = (await post('/api/px/workOrderList/draft/get', { 草稿id: d5['草稿id'] }, token))
ok('⑩ 缺路线提交被拦截且草稿仍可读', bad2.code !== 200 && g6.code === 200,
  `提交code=${bad2.code} message=${bad2.message} 草稿get=${g6.code}`)
await post('/api/px/workOrderList/draft/delete', { 草稿id: d5['草稿id'] }, token)

const failed = results.filter((x) => !x.pass)
console.log(`\n== 汇总 ${results.length - failed.length}/${results.length} PASS ==`)
console.log(JSON.stringify({
  清理用: { 常规工单: plNo1, 临时工单: plNo2, 草稿: list1.map((x) => x['草稿号']) },
}, null, 1))
process.exit(failed.length ? 1 : 0)
