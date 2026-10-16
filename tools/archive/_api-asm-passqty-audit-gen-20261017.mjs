/**
 * _api-asm-passqty-audit-gen-20261017.mjs — 「组装成品检验单**审核完成就自动生成产成品入库单**(数量按表头
 * 合格数量)」的端到端取证(2026-10-17,一次性探针)
 *
 * 用户口径:「将当前组装成品检验的合格数量（入库）修改为合格数量,并且让当前审核完成的单据能够自动生成
 *   产成品入库单其中根据合格数量填入到产成品入库单中。」
 *
 * 背景(为什么要"重走一次审核"):测试账套里 ZJ-2026-10-0085 早已是「已审核」,但它是在**旧 jar**
 * (2026-10-16 02:47 那次打包,里面没有 AsmInspStockQty 等新 class)上审的 ⇒ 走的是旧派生口径
 * (检验数量 0 − 不合格 0 = 0),一张产成品入库单都没生成。重打包后按用户拍板,用接口替它重走
 * 「弃审 → 审核」,把这张单按新口径补出来。
 *
 * 断言(全部走真后端 /px/callButton,测试账套 YJ_TEST ⇒ HSDZ_MES_TEST):
 *   ① 面板表头字段已是「合格数量」(isRequired=true、类型=小数),且**不再有**「合格数量（入库）」;
 *   ② 审核前:该单 处理方式 为空(没有入库单回执);
 *   ③ 弃审 → 200,状态回到草稿;
 *   ④ 审核 → 200,单头 处理方式 = 合格转库存(FI-…) 回执;
 *   ⑤ 产成品入库单真的存在:单据编号 = 回执里的 FI-…、备注含「合格数量」、明细实收数量 = 表头合格数量。
 *
 * ⚠ 只在**测试账套**上动单据(ZJ-2026-10-0085 是测试账套的演示单),正式库零改动。
 * 用法: node tools/archive/_api-asm-passqty-audit-gen-20261017.mjs [http://127.0.0.1:8090]
 */
import crypto from 'node:crypto'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const PANEL = 'QC_ASM_INSP'
const FIELD = '合格数量'
const OLD_FIELD = '合格数量（入库）'
const DOC = process.argv[3] || 'ZJ-2026-10-0085'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const h = b64({ alg: 'HS256' })
const b = b64({ sub: 'admin', factory: 'YJ_TEST', iat: now, exp: now + 3600 })   // YJ_TEST ⇒ 测试账套
const tk = `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`
const H = { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }
const post = async (p, body) => (await fetch(BASE + '/api' + p, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()
const get = async (p) => (await fetch(BASE + '/api' + p, { headers: H })).json()
const btn = (buttonName, formData) => post('/px/callButton', { panelCode: PANEL, buttonName, formData, buttonParam: {} })

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

/* ── ① 表头字段已正名 ── */
const cfg = (await get(`/px/getPanelConfig?panelCode=${PANEL}`)).data
const fields = cfg?.dataSchema?.fields || []
const f = fields.find((x) => (x.dataName || x.name) === FIELD)
const old = fields.find((x) => (x.dataName || x.name) === OLD_FIELD)
console.log('   表头字段数 = ' + fields.length + ' / 命中 = ' + JSON.stringify(f || null))
ok('① 表头字段是「' + FIELD + '」', !!f)
ok('① 该字段 isRequired = true(必填)', !!f && f.isRequired === true, JSON.stringify(f && { req: f.isRequired }))
ok('① 该字段类型 = 小数', !!f && f.dataType === '小数', f && f.dataType)
ok('① 旧名「' + OLD_FIELD + '」已绝迹', !old)

/* ── 取当前单据状态 ── */
const read = async () => {
  const r = await post('/px/queryFormDataList', { panelCode: PANEL, condition: { 单据编号: DOC }, pageNo: 1, pageSize: 1 })
  return (r.data?.rows || r.data?.list || [])[0] || {}
}
const before = await read()
console.log('   审核前: ' + JSON.stringify({ 单号: DOC, 状态: before['单据状态'], [FIELD]: before[FIELD], 处理方式: before['处理方式'] }))
ok('② 单据存在且已审核', String(before['单据状态'] || '') === '已审核', String(before['单据状态']))
ok('② 表头「' + FIELD + '」有值 = ' + before[FIELD], Number(before[FIELD]) > 0, String(before[FIELD]))
const passQty = Number(before[FIELD])

/* ── ③ 弃审 ── */
const un = await btn('弃审', { 编号: DOC })
console.log('   弃审 = ' + JSON.stringify(un).slice(0, 200))
ok('③ 弃审返回 200', un.code === 200, 'code=' + un.code + ' ' + un.message)
const mid = await read()
ok('③ 状态回到草稿', String(mid['单据状态'] || '') === '草稿', String(mid['单据状态']))

/* ── ④ 审核(新口径:按表头合格数量生单) ── */
const au = await btn('审核', { 编号: DOC })
console.log('   审核 = ' + JSON.stringify(au).slice(0, 200))
ok('④ 审核返回 200', au.code === 200, 'code=' + au.code + ' ' + au.message)
const after = await read()
console.log('   审核后: ' + JSON.stringify({ 状态: after['单据状态'], 处理方式: after['处理方式'] }))
ok('④ 状态回到已审核', String(after['单据状态'] || '') === '已审核', String(after['单据状态']))
const m = /合格转库存\((FI-[^)]+)\)/.exec(String(after['处理方式'] || ''))
ok('④ 单头回执 = 合格转库存(FI-…)', !!m, String(after['处理方式']))
const fiNo = m ? m[1] : ''

/* ── ⑤ 产成品入库单:数量 = 表头合格数量 ── */
if (fiNo) {
  const fin = await post('/px/queryFormDataList', { panelCode: 'FINISH_IN', condition: { 单据编号: fiNo }, pageNo: 1, pageSize: 1 })
  const head = (fin.data?.rows || fin.data?.list || [])[0] || {}
  console.log('   入库单头: ' + JSON.stringify({ 单号: fiNo, 状态: head['单据状态'], 加工单号: head['加工单号'], 备注: head['备注'] }))
  ok('⑤ 产成品入库单存在', !!head['单据编号'], JSON.stringify(fin).slice(0, 160))
  ok('⑤ 备注写明数量来源「' + FIELD + '」', String(head['备注'] || '').includes(FIELD), String(head['备注']))
  // 行级实收数量由 SQL 侧取证(见 tools/archive/_q-asm-passqty-audit-gen-verify.sql —— 与表头合格数量逐单比对)
}

console.log(fail === 0 ? `\n[PASS] ${pass} 项(审核完成 ⇒ 按表头「${FIELD}」自动生成产成品入库单)` : `\n[FAIL] ${fail} 项`)
process.exit(fail === 0 ? 0 : 1)
