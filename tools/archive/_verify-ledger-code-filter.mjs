// 验证:库存台账查询弹窗 仓库→存货 过滤改编码索引(单一性)
// 用法: node tools/archive/_verify-ledger-code-filter.mjs
// 前置: 后端 8090 已跑新 jar;迁移 migrate-ledger-code-filter.sql 已在两账套执行
const BASE = 'http://localhost:8090/api'
let token = ''

async function api(path, body, method = 'POST') {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || (j.code !== undefined && j.code !== 0 && j.code !== 200)) {
    throw new Error(`${path} HTTP ${res.status} ${JSON.stringify(j).slice(0, 300)}`)
  }
  return j.data ?? j
}

let fail = 0
function check(label, ok, detail = '') {
  console.log(`${ok ? '  OK  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) fail++
}

token = (await api('/auth/login', { userName: 'admin', password: '123456' })).token

// ── ① 联动选项:返回的应是编码清单(非名称) ─────────────────────────────
console.log('\n== ① 台账联动选项 = 编码清单 ==')
const all = await api('/px/callButton', { panelCode: 'STOCK_LEDGER', buttonName: '台账联动选项', formData: { 仓库: '', 存货: '' }, buttonParam: {} })
const whAll = all['仓库列表'] || []
const itAll = all['存货列表'] || []
console.log('  仓库列表:', JSON.stringify(whAll))
console.log('  存货列表:', JSON.stringify(itAll))
check('仓库列表为编码(如 CK01/CK00005/YCL-01 形态)', whAll.length > 0 && whAll.every(w => /^(CK|YCL|YJ-|CP-)/.test(w) || !/仓$/.test(w)), JSON.stringify(whAll))
check('存货列表为编码(YJ-*/B-*/C-*/S*/T*/A* 形态)', itAll.length > 0 && itAll.every(i => !/棉$|网$|布$|盖$|箱$|片$|签$|卡$|袋$|芯$|棒$/.test(i)), JSON.stringify(itAll))

// ── ② 按仓库编码收窄:恒亿仓(YCL-01)有流水的存货 = 恰好 SSC-Q3 + YJ-TS-004 两个编码
//    (YJ-TS-004 名叫 PP棉,档案里 18 个码同名;名称口径会收出整批 18 个,编码口径只出有流水的 1 个) ──
console.log('\n== ② 仓库→存货编码收窄(单一性) ==')
const byWh = await api('/px/callButton', { panelCode: 'STOCK_LEDGER', buttonName: '台账联动选项', formData: { 仓库: 'YCL-01', 存货: '' }, buttonParam: {} })
console.log('  YCL-01 存货列表:', JSON.stringify(byWh['存货列表']))
check('恒亿仓收窄后存货恰为 [SSC-Q3,YJ-TS-004](PP棉 18 码仅 YJ-TS-004 有流水)', JSON.stringify(byWh['存货列表']) === JSON.stringify(['SSC-Q3', 'YJ-TS-004']), JSON.stringify(byWh['存货列表']))

// 反向:选了存货编码 → 仓库列表收窄
const byIt = await api('/px/callButton', { panelCode: 'STOCK_LEDGER', buttonName: '台账联动选项', formData: { 仓库: '', 存货: 'YJ-JPL-033' }, buttonParam: {} })
console.log('  YJ-JPL-033 仓库列表:', JSON.stringify(byIt['仓库列表']))
check('存货 YJ-JPL-033 收窄仓库 ⊆ {CK00005,CK01,CP-02}', (byIt['仓库列表'] || []).length > 0 && (byIt['仓库列表'] || []).every(w => ['CK00005', 'CK01', 'CP-02'].includes(w)), JSON.stringify(byIt['仓库列表']))

// ── ③ 台账查询按编码:仓库/存货条件值=编码,行应只含该编码(一仓一存货) ──
console.log('\n== ③ 台账查询按编码精确等值 ==')
const q = await api('/px/queryFormDataList', {
  panelCode: 'STOCK_LEDGER',
  condition: { 仓库: 'YCL-01', 存货: 'YJ-TS-004', 开始日期: '2000-01-01', 结束日期: '2099-12-31' },
  pageNo: 1, pageSize: 500, keyword: '',
})
const rows = q.list || []
console.log(`  查询行数=${rows.length} totalSize=${q.totalSize}`)
const codes = [...new Set(rows.map(r => String(r['存货编码'] ?? '').trim()).filter(Boolean))]
const whs = [...new Set(rows.map(r => String(r['仓库编码'] ?? '').trim()).filter(Boolean))]
check('明细行存货编码唯一(YJ-TS-004)', codes.every(c => c === 'YJ-TS-004'), JSON.stringify(codes))
check('明细行仓库编码唯一(YCL-01)', whs.every(w => w === 'YCL-01'), JSON.stringify(whs))
const opening = rows.find(r => r['单据类型'] === '期初结存')
const closing = rows.find(r => r['单据类型'] === '期末结存')
check('期初结存行存在', !!opening, opening ? `期初数量=${opening['期初数量']} 期初金额=${opening['期初金额']}` : '缺期初行(或未到首页)')
check('期末结存行存在', !!closing, closing ? `期末数量=${closing['期末数量']} 期末金额=${closing['期末金额']}` : '缺期末行(或未到末页)')

// ④ 同名异码不带流水的编码查询 → 空(单一性:名字不再并流)
const q2 = await api('/px/queryFormDataList', {
  panelCode: 'STOCK_LEDGER',
  condition: { 仓库: 'YCL-01', 存货: 'YJ-AJ-011', 开始日期: '2000-01-01', 结束日期: '2099-12-31' },
  pageNo: 1, pageSize: 50, keyword: '',
})
const rows2 = (q2.list || []).filter(r => r['单据类型'] !== '期初结存' && r['单据类型'] !== '期末结存')
check('同名异码(YJ-AJ-011 也叫 PP棉)在恒亿仓查询为空', rows2.length === 0, `行数=${rows2.length}`)

// ⑤ 库存状况表(共享级联)联动也走编码
const bal = await api('/px/callButton', { panelCode: 'STOCK_BALANCE', buttonName: '台账联动选项', formData: { 仓库: 'YCL-01', 存货: '' }, buttonParam: {} })
console.log('  STOCK_BALANCE YCL-01 存货列表:', JSON.stringify(bal['存货列表']))
check('库存状况表联动同为编码清单', JSON.stringify(bal['存货列表']) === JSON.stringify(['SSC-Q3', 'YJ-TS-004']), JSON.stringify(bal['存货列表']))

// ⑥ 面板配置下发的参照键(refField=编码,display 仍名称)
const cfg = await api(`/px/getPanelConfig?panelCode=STOCK_LEDGER`, undefined, 'GET')
const qf = (cfg?.metadata?.panelPageDto?.tablePages?.[0]?.queryFields) || []
const whF = qf.find(f => f.dataName === '仓库')
const itF = qf.find(f => f.dataName === '存货')
check('面板配置 仓库.refField=仓库编码 displayField=仓库名称', whF?.refField === '仓库编码' && whF?.displayField === '仓库名称', JSON.stringify({ refField: whF?.refField, displayField: whF?.displayField }))
check('面板配置 存货.refField=存货编码 displayField=存货名称', itF?.refField === '存货编码' && itF?.displayField === '存货名称', JSON.stringify({ refField: itF?.refField, displayField: itF?.displayField }))

console.log(fail === 0 ? '\n全部通过 ✓' : `\n${fail} 项失败 ✗`)
process.exit(fail === 0 ? 0 : 1)
