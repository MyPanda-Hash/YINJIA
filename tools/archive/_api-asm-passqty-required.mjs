/**
 * _api-asm-passqty-required.mjs — 组装成品检验单表头「合格数量」**必填**的端到端取证(2026-10-17,一次性探针)
 *
 * 验(全部走真后端 /px/callButton):
 *   ① 新增一张草稿 → 只填其它必填(工单号)、**不填**「合格数量」→ 保存必须被拒,且报错点名该字段;
 *   ② 填上 合格数量= 7 → 保存成功;
 *   ③ 重新取数:库里两列(qc_asm_insp_head.合格数量)真的落了 7;
 *   ④ 清理:删除这张探针单。
 *
 * ⚠ 只在**测试账套**(令牌工厂声明 YJ_TEST ⇒ HSDZ_MES_TEST,ADR-0003)上写;跑完即删,正式库零改动。
 * 用法: node tools/archive/_api-asm-passqty-required.mjs [http://127.0.0.1:8090]
 */
import crypto from 'node:crypto'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const PANEL = 'QC_ASM_INSP'
const FIELD = '合格数量'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const h = b64({ alg: 'HS256' })
const b = b64({ sub: 'admin', factory: 'YJ_TEST', iat: now, exp: now + 3600 })   // YJ_TEST ⇒ 测试账套
const tk = `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`
const H = { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }
const post = async (p, body) => (await fetch(BASE + '/api' + p, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()
const btn = (buttonName, formData) => post('/px/callButton', { panelCode: PANEL, buttonName, formData, buttonParam: {} })

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const mk = await btn('新增流程', {})
const no = mk.data?.编号 || mk.data?.单据编号 || ''
ok('① 新增草稿成功(测试账套)', !!no && mk.code === 200, JSON.stringify(mk).slice(0, 160))
if (!no) process.exit(1)
console.log('   探针单号 = ' + no)

try {
  // ① 不填「合格数量」→ 保存必须被拒(其它必填给全:工单号)
  const r1 = await btn('保存', { 编号: no, 工单号: 'PROBE-PASSQTY', 单据日期: new Date().toISOString().slice(0, 10) })
  console.log('   未填保存 = ' + JSON.stringify(r1).slice(0, 200))
  ok('① 未填「' + FIELD + '」→ 保存被拒', r1.code !== 200, 'code=' + r1.code)
  ok('① 报错点名该字段', String(r1.message || '').includes(FIELD), r1.message)

  // ② 填 7 → 保存成功
  const r2 = await btn('保存', { 编号: no, 工单号: 'PROBE-PASSQTY', 单据日期: new Date().toISOString().slice(0, 10), [FIELD]: 7 })
  console.log('   填 7 保存 = ' + JSON.stringify(r2).slice(0, 200))
  ok('② 填「' + FIELD + '」= 7 → 保存成功', r2.code === 200, JSON.stringify(r2).slice(0, 160))

  // ③ 取数复核(明细/表头接口)
  const list = await post('/px/queryFormDataList', { panelCode: PANEL, condition: { 单据编号: no }, pageNo: 1, pageSize: 1 })
  const row = (list.data?.rows || list.data?.list || [])[0] || {}
  console.log('   回读: ' + JSON.stringify({ [FIELD]: row[FIELD], 工单号: row['工单号'], 单据状态: row['单据状态'] }))
  ok('③ 库里落了 ' + FIELD + ' = 7', Number(row[FIELD]) === 7, String(row[FIELD]))
} finally {
  const del = await btn('删除', { 编号: no })
  console.log('   清理(删除探针单) = ' + JSON.stringify(del).slice(0, 120))
  ok('④ 探针单已删除(测试账套不留痕)', del.code === 200, JSON.stringify(del).slice(0, 120))
}

console.log(fail === 0 ? `\n[PASS] ${pass} 项(表头「${FIELD}」必填端到端)` : `\n[FAIL] ${fail} 项`)
process.exit(fail === 0 ? 0 : 1)
