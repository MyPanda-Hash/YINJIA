/**
 * _api-record-sheets.mjs — 造粒记录/无黑处理登记/封箱确认「表头 + 明细」改造的 API 级验收。
 *
 * 2026-10-18 用户口径:「可以新增但是没有看到明细表」⇒ 三张记录表由「整张表头」改为
 * 「表头(5 个字段) + 明细(15/7/5 列)」,明细列取自 migrate-record-sheets-head-detail-20261018.sql。
 *
 * 验收点(每面板):
 *   ① 配置层:gridTabs 列数 = 明细字段数;表头字段数 = 5;
 *   ② 新建 → 保存(2 行明细)→ 重新取数:明细行数/逐格值读回一致(温度、产品编号等);
 *   ③ 列表接口 queryFormDataList 能按单号取到该单(列表页/明细区可见的数据来源);
 *   ④ 清理:删除按钮 + 物理清理(见末尾提示)。
 *
 * ⚠ 两账套纪律:写入一律走**测试账套 HSDZ_MES_TEST**(token 的 factory=YJ_TEST);
 *   正式账套只读(下面第 ① 段只取配置,不动数据)。
 *
 * 用法:node tools/archive/_record-sheets-20261018/_api-record-sheets.mjs [apiBase]
 */
import crypto from 'node:crypto'

const api = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const token = (factory, user = 'admin') => {
  const now = Math.floor(Date.now() / 1000)
  const h = b64({ alg: 'HS256' })
  const b = b64({ sub: user, factory, iat: now, exp: now + 3600 })
  return `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`
}
const fail = []
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`PASS ${name}${extra ? ' — ' + extra : ''}`)
  else { fail.push(name); console.log(`FAIL ${name}${extra ? ' — ' + extra : ''}`) }
}
const get = async (p, tk) => (await fetch(api + p, { headers: { Authorization: 'Bearer ' + tk } })).json()
const post = async (p, body, tk) => (await fetch(api + p, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})).json()

const prod = token('YJ')
const test = token('YJ_TEST')

/** 面板 → { 日期列, 表头字段数, 明细字段数, 两行明细 } */
const PANELS = [
  {
    code: 'GRAN_RECORD', name: '造粒记录', dateKey: '单据日期',
    detailCount: 15, headCount: 5,
    rows: [
      { 物料名称: '颗粒料A', 生产批次: 'P-001', 'Z-HP-C批次': 'HP1', 'Z-G-C批次': 'G1', 活性粉: '粉1', '温度/℃': 27.5, '湿度/%': 80, 'P-E/kg': 11, '纯水/kg': 10.8, 捏合时间: '8:02', 吹扫时间: '45+11', 测试时间: '9:20', '水分含量/%': 19.9, 取样测试人: '张三', 操作员: '李四' },
      { 物料名称: '颗粒料B', 生产批次: 'P-002', 'Z-HP-C批次': 'HP2', 'Z-G-C批次': 'G2', 活性粉: '粉2', '温度/℃': 28.5, '湿度/%': 81, 'P-E/kg': 12, '纯水/kg': 11.2, 捏合时间: '8:32', 吹扫时间: '45+12', 测试时间: '9:30', '水分含量/%': 20.1, 取样测试人: '张三', 操作员: '李四' },
    ],
  },
  {
    code: 'WH_RECORD', name: '无黑处理登记', dateKey: '单据日期',
    detailCount: 7, headCount: 5,
    rows: [
      { 成型日期: '2026-10-18', 产品编号: 'D-01-25', 尺寸: '48x30x166', 加湿前重量: 185.4, 加湿后重量: 190.2, 无黑时间: '26', 取样时间: '8:26' },
      { 成型日期: '2026-10-18', 产品编号: 'B-92-12', 尺寸: '40.5x22x118', 加湿前重量: 67.8, 加湿后重量: 69.9, 无黑时间: '26', 取样时间: '8:27' },
    ],
  },
  {
    code: 'PACK_CONFIRM', name: '封箱确认', dateKey: '装箱日期',
    detailCount: 5, headCount: 5,
    rows: [
      { 产品编号: 'C-PK-41', 装箱数量: '1X62+37', 装箱人: '王五', 确认人: '刘六', 主管签名: '余' },
      { 产品编号: 'B-P0-02', 装箱数量: '4X86+23', 装箱人: '王五', 确认人: '刘六', 主管签名: '余' },
    ],
  },
]

const created = []

console.log('== ① 正式账套只读:配置层(列数/表头数)==')
for (const p of PANELS) {
  const cfg = await get(`/px/getPanelConfig?panelCode=${p.code}`, prod)
  const tp = cfg?.data?.metadata?.panelPageDto?.tablePages?.[0] || {}
  const cols = tp.gridTabs?.[0]?.columns || []
  const fields = cfg?.data?.detail?.tabs?.[0]?.fields || []
  const headNames = String((cfg?.data?.metadata?.formPages?.[0]?.fieldNames) || '').split(',').filter(Boolean)
  ok(`[${p.name}] 列表页明细列 = ${p.detailCount}`, cols.length === p.detailCount, `实测 ${cols.length}: ${cols.join('/')}`)
  ok(`[${p.name}] 表单明细字段 = ${p.detailCount}`, fields.length === p.detailCount, `实测 ${fields.length}`)
  ok(`[${p.name}] 表头字段 = ${p.headCount}`, headNames.length === p.headCount, `实测 ${headNames.length}: ${headNames.join('/')}`)
}

console.log('\n== ② 测试账套:建单 → 存 2 行明细 → 读回 ==')
for (const p of PANELS) {
  const mk = await post('/px/callButton', { panelCode: p.code, buttonName: '新增流程', formData: {}, buttonParam: {} }, test)
  const no = mk?.data?.编号 || mk?.data?.单据编号 || ''
  ok(`[${p.name}] 新增流程出单号`, !!no, no || JSON.stringify(mk).slice(0, 160))
  if (!no) continue
  created.push({ panel: p.code, no })

  const fd = { 编号: no, 单据编号: no, [p.dateKey]: '2026-10-18', detail: { items: p.rows } }
  const saved = await post('/px/callButton', { panelCode: p.code, buttonName: '保存', formData: fd, buttonParam: { code: no } }, test)
  ok(`[${p.name}] 保存(含明细 2 行)`, saved.code === 200, JSON.stringify(saved).slice(0, 160))
  // 保存返回的编号才是真落库单号(新增流程出的是预览/草稿号;不带「编号」保存会另开一张)
  const savedNo = String(saved?.data?.编号 || saved?.data?.单据编号 || no)
  created[created.length - 1].no = savedNo

  const fd2 = await get(`/px/getFormDescriptor?panelCode=${p.code}&code=${encodeURIComponent(savedNo)}`, test)
  const items = fd2?.data?.detailData?.items || []
  ok(`[${p.name}] 重新取数:明细 2 行`, items.length === 2, `实测 ${items.length} 行`)
  const first = items[0] || {}
  const k1 = Object.keys(p.rows[0])[0]
  ok(`[${p.name}] 明细首行首列回读一致(${k1})`,
    String(first[k1] ?? '') === String(p.rows[0][k1]),
    `存 ${p.rows[0][k1]} / 读 ${first[k1]}`)
  const kNum = Object.keys(p.rows[0]).find((k) => typeof p.rows[0][k] === 'number')
  if (kNum) {
    ok(`[${p.name}] 数值列回读一致(${kNum})`,
      Number(first[kNum]) === Number(p.rows[0][kNum]),
      `存 ${p.rows[0][kNum]} / 读 ${first[kNum]}`)
  }

  const q = await post('/px/queryFormDataList', { panelCode: p.code, pageNo: 1, pageSize: 20 }, test)
  const hit = (q?.data?.list || []).filter((r) => (r['编号'] || r['单据编号']) === savedNo)
  ok(`[${p.name}] 列表接口按单号取到该单`, hit.length === 1, `totalSize=${q?.data?.totalSize}`)
  ok(`[${p.name}] 列表行带明细 2 行`, (hit[0]?.detail?.items || []).length === 2, `实测 ${(hit[0]?.detail?.items || []).length}`)
}

console.log('\n== ③ 清理(删除按钮;物理行见末尾提示)==')
for (const c of created) {
  const del = await post('/px/callButton', { panelCode: c.panel, buttonName: '删除', formData: { 编号: c.no }, buttonParam: { code: c.no } }, test)
  ok(`[${c.panel}] ${c.no} 删除动作`, del.code === 200, JSON.stringify(del).slice(0, 140))
}
if (created.length) {
  console.log('\n探针单(测试账套,需物理清理):')
  for (const c of created) console.log(`  ${c.panel} ${c.no}`)
}

console.log(fail.length ? `\n=== 失败 ${fail.length} 项: ${fail.join(' | ')} ===` : '\n=== 全部通过 ===')
process.exit(fail.length ? 1 : 0)
