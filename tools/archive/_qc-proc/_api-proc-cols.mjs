/**
 * _api-proc-cols.mjs — 制程检验单「列数」字段**落库往返**验收(API 级,免口令)。
 *
 * 只读部分:正式账套 HSDZ_MES —— 取一张现有单的 getFormDescriptor,确认
 *   ① hidden 头字段(检验时间)确实随单据下发(⇒ 新登记的 hidden 头字段 列数 也会下发);
 *   ② 列数 键在头字段集合里(未设过时为空)。
 * 写入部分:测试账套 HSDZ_MES_TEST(AGENTS.md 两账套纪律:演示/造数一律走测试库)——
 *   建一张草稿 → 保存 列数=2 → 重新取数断言 列数=2 → **删掉这张探针单**(不留痕)。
 *
 * 用法:node tools/archive/_qc-proc/_api-proc-cols.mjs [apiBase]
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
async function get(path, tk) {
  const r = await fetch(api + path, { headers: { Authorization: 'Bearer ' + tk } })
  return r.json()
}
async function post(path, body, tk) {
  const r = await fetch(api + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

// ── ① 正式账套:只读取证 ──
const prod = token('YJ')
const cfg = await get('/px/getPanelConfig?panelCode=QC_PROC_INSP', prod)
const schemaNames = (cfg.data?.dataSchema?.fields || []).map((f) => f.dataName)
ok('面板配置里登记了「列数」头字段', schemaNames.includes('列数'), schemaNames.filter((n) => /列数|检验时间/.test(n)).join(','))
const no = 'ZC-2026-10-0001'
const fd = await get(`/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=${no}`, prod)
const head = fd.data?.data || {}
ok(`现有单 ${no} 取数成功`, !!head['单据编号'] || !!head['编号'], JSON.stringify(Object.keys(head).slice(0, 6)))
ok('hidden 头字段「检验时间」随单据下发(hidden 头字段的取数通道是通的)', '检验时间' in head)
// 未设过的 列数 = NULL ⇒ 后端序列化时**整个键不出现**(与 检验时间 有值时出现对照);
// 组件把 undefined 当「没设过」处理(min=1),所以这里只做记录、不当失败。
console.log(`  「列数」键${'列数' in head ? '在' : '不在'}单据头数据里(NULL 值不下发)`)
console.log(`  现状:${no} 列数=${JSON.stringify(head['列数'])} 检验时间=${JSON.stringify(head['检验时间'])}`)

// ── ② 测试账套:写入往返 + 清理 ──
const test = token('YJ_TEST')
let created = ''
try {
  const mk = await post('/px/callButton', { panelCode: 'QC_PROC_INSP', buttonName: '新增流程', formData: {}, buttonParam: {} }, test)
  created = mk.data?.编号 || mk.data?.单据编号 || ''
  ok('测试账套建草稿成功', !!created, JSON.stringify(mk).slice(0, 160))
  if (created) {
    const saved = await post('/px/callButton', {
      panelCode: 'QC_PROC_INSP',
      buttonName: '保存',
      formData: { 编号: created, 单据编号: created, 列数: '2', 检验类别: '制程检验' },
      buttonParam: {},
    }, test)
    ok('保存(带 列数=2)成功', saved.code === 200, JSON.stringify(saved).slice(0, 200))
    const back = await get(`/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=${created}`, test)
    const h2 = back.data?.data || {}
    ok('重新取数:列数 = 2(真落库)', String(h2['列数']) === '2', `列数=${JSON.stringify(h2['列数'])}`)
    const detail = back.data?.detailData || back.data?.detail || {}
    const items = (detail.items || (detail.tabs && detail.tabs[0] && detail.tabs[0].items) || [])
    ok('明细行通道正常(空单 0 行)', Array.isArray(items), `rows=${items.length}`)
    // 空列「惰性建行」的行形状(表区/检验项目/行号/格数 + 测量值k)能不能真落库
    const probeRow = { 表区: '尺寸', 检验项目: '探针-外径', 行号: 1, 检验要求: '', 检验方法: '', 单项判定: '', 格数: 1, 测量值1: '1.5' }
    const saved2 = await post('/px/callButton', {
      panelCode: 'QC_PROC_INSP',
      buttonName: '保存',
      formData: { 编号: created, 单据编号: created, 列数: '2', detail: { items: [probeRow] } },
      buttonParam: {},
    }, test)
    ok('保存明细行(惰性建行的形状)成功', saved2.code === 200, JSON.stringify(saved2).slice(0, 160))
    const back2 = await get(`/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=${created}`, test)
    const rows2 = back2.data?.detailData?.items || []
    const r0 = rows2[0] || {}
    ok('明细行真落库(表区/检验项目/格数/测量值1 逐一读回)',
      rows2.length === 1 && r0['表区'] === '尺寸' && r0['检验项目'] === '探针-外径'
        && String(r0['格数']) === '1' && Number(r0['测量值1']) === 1.5,
      JSON.stringify(rows2).slice(0, 200))
    ok('头字段 列数 与明细行同时存得住', String(back2.data?.data?.['列数']) === '2', `列数=${JSON.stringify(back2.data?.data?.['列数'])}`)
    // 清理:删掉探针单(先试按钮删除,不行再由 SQL 软删)
    const del = await post('/px/callButton', { panelCode: 'QC_PROC_INSP', buttonName: '删除', formData: { 编号: created }, buttonParam: {} }, test)
    const still = await get(`/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=${created}`, test)
    const gone = (still.data?.data?.单据状态 === '已作废') || !(still.data?.data) || still.code !== 200
    ok('探针单已清理(删除/作废)', gone || del.code === 200, `del=${JSON.stringify(del).slice(0, 120)} 单据状态=${still.data?.data?.单据状态}`)
    console.log(`  探针单:${created}`)
  }
} catch (e) {
  console.log('WRITE PROBE ERROR: ' + (e?.stack || e))
  fail.push('write-probe')
}
console.log(fail.length ? `\n=== 失败 ${fail.length} 项: ${fail.join(', ')} ===` : '\n=== 全部通过 ===')
process.exit(fail.length ? 1 : 0)
