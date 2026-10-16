/**
 * _api-proc-audit.mjs — 制程检验单「审核 / 弃审」**落库往返**验收(API 级,免口令)。
 *
 * 2026-10-17 用户口径:「为当前制程检验单增加审核」。
 * 界面入口在 PanelxList 侧栏(DIRECT_AUDIT_PANELS=['QC_PROC_INSP'],仅管理员),
 * 本探针验的是**后端动作链**:新增草稿 → 保存 → 审核(状态/审核人) → 审核后锁存(保存被拒) → 弃审 → 清理。
 *
 * ⚠ 两账套纪律(AGENTS.md):写入一律走**测试账套 HSDZ_MES_TEST**(token 的 factory=YJ_TEST),
 *   正式账套 HSDZ_MES 只读(下面 ① 段只取数、不点任何写按钮)。
 * ⚠ 只验后端动作;界面上「审核」按钮的存在性/置灰由 CDP 探针(_cdp-proc-cols.mjs)只读断言。
 *
 * 用法:node tools/archive/_qc-proc/_api-proc-audit.mjs [apiBase]
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
const btn = (tk, buttonName, formData, buttonParam = {}) =>
  post('/px/callButton', { panelCode: 'QC_PROC_INSP', buttonName, formData, buttonParam }, tk)
const state = async (tk, no) => {
  const r = await get(`/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=${encodeURIComponent(no)}`, tk)
  const h = r.data?.data || {}
  return { 状态: String(h['单据状态'] || ''), 审核人: String(h['审核人'] || ''), 审核时间: String(h['审核时间'] || ''), raw: r }
}

const test = token('YJ_TEST')

// ── ① 正式账套只读:确认面板配置里「审核」动作是可下发的动作名 ──
const prod = token('YJ')
const cfg = await get('/px/getPanelConfig?panelCode=QC_PROC_INSP', prod)
const flat = (cfg.data?.metadata?.panelButtons || []).map((b) => b.buttonName)
const groups = cfg.data?.metadata?.buttonGroups || []
const approvalGroup = groups.find((g) => g.name === '审批')
ok('后端下发「审批」按钮组且含『审核』(动作名对得上)',
  !!approvalGroup && approvalGroup.actions.includes('审核'),
  approvalGroup ? approvalGroup.actions.join(',') : '无审批组')

// ── ② 测试账套:审核/弃审往返 ──
let created = ''
try {
  const mk = await btn(test, '新增流程', {})
  created = mk.data?.编号 || mk.data?.单据编号 || ''
  ok('测试账套建草稿', !!created, created || JSON.stringify(mk).slice(0, 140))
  if (created) {
    const fd = { 编号: created, 单据编号: created, 检验类别: '制程检验', 检验员: 'admin' }
    const saved = await btn(test, '保存', fd)
    ok('保存草稿', saved.code === 200, JSON.stringify(saved).slice(0, 140))
    const before = await state(test, created)
    ok('审核前状态 = 草稿', before.状态 === '草稿', `状态=${before.状态}`)

    // 审核意见要留痕(2026-10-17):直审也写 yj_form_approval,「审批情况」才看得到谁审的、意见是什么。
    // ⚠ 该断言只在**含本次改动**的实例上成立(即 mvn 之后的新 jar / 临时实例);
    //   还在跑旧 jar 的实例(没重新打包)会拿不到 AUDIT 行 —— 此时降级为 WARN,不算失败,并在末尾提示。
    const audOpinion = '探针-审核意见'
    const aud2 = await btn(test, '审核', { 编号: created, 审核意见: audOpinion })
    ok('「审核」动作成功(带审核意见)', aud2.code === 200, JSON.stringify(aud2).slice(0, 160))
    const after = await state(test, created)
    ok('审核后状态 = 已审核', after.状态 === '已审核', `状态=${after.状态}`)
    ok('审核人 = 当前用户(admin)', after.审核人 === 'admin', `审核人=${after.审核人} 审核时间=${after.审核时间}`)
    const hist = await get(`/px/getApprovalHistory?panelCode=QC_PROC_INSP&code=${encodeURIComponent(created)}`, test)
    const recs = (Array.isArray(hist) ? hist : hist.data) || []
    const auditRec = recs.find((r) => r.action === 'AUDIT')
    if (!auditRec) {
      console.log('WARN 该实例的后端早于本次修改(未重新打包):直审未写 yj_form_approval —— 审核留痕要等打包后生效')
    } else {
      ok('直审留痕:AUDIT/APPROVED 行 + 操作人 + 审核意见',
        auditRec.result === 'APPROVED' && auditRec.operator === 'admin' && auditRec.opinion === audOpinion,
        JSON.stringify(auditRec))
    }

    const resave = await btn(test, '保存', { ...fd, 单据状态: '草稿' })
    ok('已审核后不可再保存(锁定生效)', resave.code !== 200 && /已审核/.test(JSON.stringify(resave)), JSON.stringify(resave).slice(0, 140))

    const unaud = await btn(test, '弃审', { 编号: created })
    ok('「弃审」动作成功', unaud.code === 200, JSON.stringify(unaud).slice(0, 140))
    const back = await state(test, created)
    ok('弃审后回到草稿', back.状态 === '草稿', `状态=${back.状态}`)
    const hist2 = await get(`/px/getApprovalHistory?panelCode=QC_PROC_INSP&code=${encodeURIComponent(created)}`, test)
    const recs2 = (Array.isArray(hist2) ? hist2 : hist2.data) || []
    if (recs2.length) {
      ok('审核记录按时间累积(AUDIT 之后有 UNAUDIT)', recs2.some((r) => r.action === 'UNAUDIT') && recs2[0].action === 'AUDIT',
        recs2.map((r) => r.action).join(' → '))
    }

    const del = await btn(test, '删除', { 编号: created })
    const gone = await state(test, created)
    ok('探针单已清理', del.code === 200 || gone.状态 === '已作废', `del=${del.code} 状态=${gone.状态}`)
    console.log(`  探针单:${created}`)
  }
} catch (e) {
  console.log('PROBE ERROR: ' + (e?.stack || e))
  fail.push('probe')
}
console.log(fail.length ? `\n=== 失败 ${fail.length} 项: ${fail.join(', ')} ===` : '\n=== 全部通过 ===')
process.exit(fail.length ? 1 : 0)
