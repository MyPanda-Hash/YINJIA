/**
 * _e2e-audit-unaudit.mjs —— 5 张检验单据「审核(提交审批→审批通过) + 反审核(弃审)」全流程验证
 *
 * 覆盖面板(需求口径:所有检验单据都要能审核和反审核):
 *   QC_FIRST_INSP 首件检验单   ┐
 *   QC_PROC_INSP  制程检验单   ├ 两级审批:提交审批 → 一级审批通过(待二级)→ 超级管理员批准(已审核)
 *   QC_OQC_REPORT 出厂检验报告 ┘
 *   QC_ASM_INSP   组装成品检验单 ┐ 单节点审批:提交审批 → 审批通过(已审核)
 *   QC_INSP       来料检验单     ┘
 *
 * 每张走:草稿 → 提交审批(审批中) → 审批通过(一级/单节点) → [二级批准] → 已审核 → 弃审 → 回到草稿。
 * 每步断言:callButton 返回码/返回单据状态、yj_doc_status 状态机(pending/approve_node/shr/pending_by)、
 * yj_form_approval 留痕、纸面签署格(仅 QC_DOC_PREPARER 登记的三张:编制=提交人/审核=一级/批准=管理员)。
 *
 * 只在 **测试账套**(YJ_TEST → HSDZ_MES_TEST)执行;绝不写正式库(DB_NAME() 硬闸门)。
 * 用**现有草稿**验证:测完先弃审回草稿,再把本轮产生的审批留痕 / 状态行 / 签署格 / 自动生单下游单
 * **整行还原**成测前快照(公共件见 _doc-lib.mjs),做到「不留脏数据」。
 *
 * 用法:
 *   node tools/archive/_wo-insp-audit-20261108/_e2e-audit-unaudit.mjs [--base http://127.0.0.1:8090]
 *        [--only=QC_FIRST_INSP,QC_INSP] [--no-cleanup]
 * 产物:evidence/run-<stamp>/(逐面板 JSON + summary.json + run.log)
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  login, api, okCall, openTestDb, S, saveJson, saveText, nowStamp, EVIDENCE,
} from './_lib.mjs'
import {
  PANELS, rowByKey, rowsByKey, scalar, docStatus, approvals, S_, snapshot,
  newDownstream, cleanupAndRestore, deriveStatus,
} from './_doc-lib.mjs'

/* ───────────────────────── 参数/日志 ───────────────────────── */
const argv = process.argv.slice(2)
const arg = (n, d) => {
  const eq = argv.find((x) => x.startsWith('--' + n + '='))
  if (eq) return eq.slice(n.length + 3)
  const i = argv.indexOf('--' + n)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const BASE = String(arg('base', process.env.YJ_BASE || 'http://127.0.0.1:8090')).replace(/\/$/, '')
const ONLY = arg('only', '') ? String(arg('only')).split(',').map((s) => s.trim()).filter(Boolean) : []
const DO_CLEANUP = !argv.includes('--no-cleanup')
const FACTORY = 'YJ_TEST'
const STAMP = nowStamp()
const OUT = path.join(EVIDENCE, 'run-' + STAMP)
fs.mkdirSync(OUT, { recursive: true })
const LOG = []
function log(...a) {
  const line = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')
  LOG.push(line)
  console.log(line)
}

/* ───────────────────────── 断言收集 ───────────────────────── */
let PASS = 0, FAIL = 0
const checks = []
function check(name, ok, detail = '') {
  const item = { name, ok: !!ok, detail: String(detail ?? '').slice(0, 3000) }
  checks.push(item)
  if (ok) PASS++; else FAIL++
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + String(detail).slice(0, 400) : ''}`)
  return ok
}
const fact = (name, value) => { checks.push({ name, ok: null, detail: JSON.stringify(value) }); log(`FACT  ${name} = ${JSON.stringify(value).slice(0, 400)}`) }

/* ───────────────────────── 主流程 ───────────────────────── */
const ctx = { db: null, cli: null }
const summary = []
let CURRENT_PANEL = null // 供异常时兜底还原

try {
  ctx.db = await openTestDb()
  const dbName = S_(await scalar(ctx.db, 'SELECT DB_NAME() v'))
  if (dbName !== 'HSDZ_MES_TEST') throw new Error('拒绝: 当前库 ' + dbName + ' != HSDZ_MES_TEST')
  log('[db] ' + dbName)

  const adm = await login(BASE, { factory: FACTORY, userName: 'admin', password: '123456' })
  ctx.cli = api(BASE, adm.token)
  const adminReal = S_(adm.user.realName || adm.user.real_name || '系统管理员')
  log(`[login] admin → realName=${adminReal} isAdmin=${adm.user.isAdmin}`)
  fact('环境', { base: BASE, factory: FACTORY, db: dbName, admin: { userName: 'admin', realName: adminReal, isAdmin: adm.user.isAdmin } })

  const targets = ONLY.length ? PANELS.filter((p) => ONLY.includes(p.code)) : PANELS
  for (const P of targets) {
    log(`\n══════════ ${P.code} ${P.name}（${P.l2 ? '两级审批' : '单节点审批'}）══════════`)
    const rec = { panel: P.code, name: P.name, l2: P.l2, docNo: '', steps: [], cleanup: null }
    let no = '', pre = null, downs = null, err = null
    const startCheck = checks.length
    try {
      /* ① 选一条草稿 */
      for (const cand of P.candidates) {
        const head = await rowByKey(ctx.db, P.head, '单据编号', cand)
        if (!head) continue
        const st = await docStatus(ctx.db, P.code, cand)
        log(`[候选] ${cand} 状态=${st.status}`)
        if (st.status === '草稿') { no = cand; break }
      }
      if (!no) throw new Error('没有可用草稿:' + JSON.stringify(P.candidates))
      rec.docNo = no
      pre = await snapshot(ctx.db, P, no)
      rec.pre = { status: deriveStatus(pre.stRow), head: pre.head, detailCount: pre.detail.length, linkCount: pre.links.length, approvalMaxId: pre.maxAppr }
      fact(`${P.code} 选中文档`, { no, 状态: rec.pre.status, 明细行: pre.detail.length, 已有流程链: pre.links.length })
      check(`${P.code}/${no} 起点是草稿`, rec.pre.status === '草稿', 'status=' + rec.pre.status)

      const sig = P.sign
      const headSnap = pre.head
      const trailOf = (appr, action, result, node) => appr.some((a) => a.action === action && a.result === result && (node === undefined || Number(a.node_no) === node))
      const headNow = () => rowByKey(ctx.db, P.head, '单据编号', no)

      async function step(name, buttonName, formData, expectStatus) {
        const before = await docStatus(ctx.db, P.code, no)
        const res = await ctx.cli.callButton(P.code, buttonName, { 编号: no, ...formData })
        const after = await docStatus(ctx.db, P.code, no)
        const appr = await approvals(ctx.db, P.code, no)
        const head = await headNow()
        rec.steps.push({
          step: name, button: buttonName, payload: { 编号: no, ...formData },
          response: { httpStatus: res.httpStatus, code: res.code, message: res.message, data: res.data },
          statusBefore: before.status, statusAfter: after.status,
          statusRow: after.row, approvalTrail: appr,
          headSigns: sig ? Object.fromEntries(Object.values(sig).map((c) => [c, head ? head[c] : null])) : null,
        })
        log(`── ${name}: 「${buttonName}」→ code=${res.code} data=${JSON.stringify(res.data)} 状态 ${before.status} → ${after.status}`)
        check(`${P.code}/${no} ${name}: 接口成功`, okCall(res), `code=${res.code} msg=${res.message} data=${JSON.stringify(res.data)}`)
        check(`${P.code}/${no} ${name}: 返回单据状态=${expectStatus}`, S_(res.data && res.data['单据状态']) === expectStatus, '实际=' + S_(res.data && res.data['单据状态']))
        check(`${P.code}/${no} ${name}: DB 派生状态=${expectStatus}`, after.status === expectStatus, '实际=' + after.status)
        return { res, before, after, appr, head }
      }

      /* ② 提交审批 → 审批中(节点 1) */
      {
        const r = await step('提交审批', '提交审批', {}, '审批中')
        check(`${P.code}/${no} 提交后 pending=Y / node=1`,
          S_(r.after.row.pending).toUpperCase() === 'Y' && Number(r.after.row.approve_node) === 1,
          JSON.stringify({ pending: r.after.row.pending, node: r.after.row.approve_node }))
        check(`${P.code}/${no} 提交后 pending_by=admin`, S_(r.after.row.pending_by) === 'admin', 'pending_by=' + S_(r.after.row.pending_by))
        check(`${P.code}/${no} 留痕 SUBMIT/PENDING`, trailOf(r.appr, 'SUBMIT', 'PENDING'), r.appr.map((a) => a.action + '/' + a.result).join(','))
        if (sig) {
          check(`${P.code}/${no} 提交后「${sig.prep}」有值(编制=提交人)`, S_(r.head[sig.prep]) !== '', `${sig.prep}=${S_(r.head[sig.prep])}`)
          check(`${P.code}/${no} 提交后「${sig.l1}」「${sig.l2}」为空`,
            S_(r.head[sig.l1]) === '' && S_(r.head[sig.l2]) === '', JSON.stringify({ l1: r.head[sig.l1], l2: r.head[sig.l2] }))
        }
      }

      /* ③ 一级审批通过(两级面板 → 待二级;单节点 → 已审核) */
      {
        const r = await step('审批通过(一级/单节点)', '审批通过', { 审批意见: 'E2E-0611 L1 同意' }, P.l2 ? '待二级审批' : '已审核')
        if (P.l2) {
          check(`${P.code}/${no} 一级通过后 pending=Y / node=2`,
            S_(r.after.row.pending).toUpperCase() === 'Y' && Number(r.after.row.approve_node) === 2,
            JSON.stringify({ pending: r.after.row.pending, node: r.after.row.approve_node }))
          check(`${P.code}/${no} 一级通过后 shr 为空(尚未归档)`, S_(r.after.row.shr) === '', 'shr=' + S_(r.after.row.shr))
          check(`${P.code}/${no} 留痕 APPROVE_L1/L1_PASSED@1`, trailOf(r.appr, 'APPROVE_L1', 'L1_PASSED', 1),
            r.appr.map((a) => `${a.action}/${a.result}@${a.node_no}`).join(','))
          if (sig) {
            check(`${P.code}/${no} 一级通过后「${sig.l1}」=「${adminReal}」`, S_(r.head[sig.l1]) === adminReal, `${sig.l1}=${S_(r.head[sig.l1])}`)
            check(`${P.code}/${no} 一级通过后「${sig.l1Time}」有值`, S_(r.head[sig.l1Time]) !== '', `${sig.l1Time}=${S_(r.head[sig.l1Time])}`)
            check(`${P.code}/${no} 一级通过后「${sig.l2}」为空`, S_(r.head[sig.l2]) === '', `${sig.l2}=${S_(r.head[sig.l2])}`)
          }
        } else {
          check(`${P.code}/${no} 单节点通过后 pending=N`, S_(r.after.row.pending).toUpperCase() === 'N', 'pending=' + S_(r.after.row.pending))
          check(`${P.code}/${no} 单节点通过后 shr=admin`, S_(r.after.row.shr) === 'admin', 'shr=' + S_(r.after.row.shr))
          check(`${P.code}/${no} 留痕 APPROVE/APPROVED@1`, trailOf(r.appr, 'APPROVE', 'APPROVED', 1),
            r.appr.map((a) => `${a.action}/${a.result}@${a.node_no}`).join(','))
        }
      }

      /* ④ 二级批准(仅两级面板) */
      if (P.l2) {
        const r = await step('二级批准(超级管理员)', '审批通过', { 审批意见: 'E2E-0611 L2 批准' }, '已审核')
        check(`${P.code}/${no} 二级通过后 pending=N / shr=admin`,
          S_(r.after.row.pending).toUpperCase() === 'N' && S_(r.after.row.shr) === 'admin',
          JSON.stringify({ pending: r.after.row.pending, shr: r.after.row.shr }))
        check(`${P.code}/${no} 二级通过后 approve_node 清空`, r.after.row.approve_node === null, 'node=' + r.after.row.approve_node)
        check(`${P.code}/${no} 留痕 APPROVE/APPROVED@2`, trailOf(r.appr, 'APPROVE', 'APPROVED', 2),
          r.appr.map((a) => `${a.action}/${a.result}@${a.node_no}`).join(','))
        check(`${P.code}/${no} 一级留痕 APPROVE_L1 仍在`, trailOf(r.appr, 'APPROVE_L1', 'L1_PASSED', 1), '')
        if (sig) {
          check(`${P.code}/${no} 二级通过后「${sig.l2}」=「${adminReal}」`, S_(r.head[sig.l2]) === adminReal, `${sig.l2}=${S_(r.head[sig.l2])}`)
          check(`${P.code}/${no} 二级通过后「${sig.l2Time}」有值`, S_(r.head[sig.l2Time]) !== '', `${sig.l2Time}=${S_(r.head[sig.l2Time])}`)
        }
      }
      {
        const st = await docStatus(ctx.db, P.code, no)
        check(`${P.code}/${no} 审核终态=已审核`, st.status === '已审核', 'status=' + st.status)
      }

      /* ⑤ 下游自动生单(ASM → 产成品入库草稿;QC_INSP → 采购入库草稿)—— 记录本轮新增 */
      downs = await newDownstream(ctx.db, P, no, pre)
      rec.downstream = downs
      for (const [dp, nos] of Object.entries(downs)) {
        for (const dNo of nos) {
          const st = await docStatus(ctx.db, dp, dNo)
          log(`[下游] ${dp}/${dNo} 状态=${st.status}`)
          check(`${P.code} 审核自动生成下游 ${dp}/${dNo} 且为草稿`, st.status === '草稿', 'status=' + st.status)
        }
      }

      /* ⑥ 弃审 → 回到草稿 */
      {
        const r = await step('弃审(反审核)', '弃审', {}, '草稿')
        // 单节点面板:提交时写的 approve_node=1 不会被弃审清掉(状态推导只看 pending,不影响状态;
        // 属既有实现的无害残留,这里只要求 pending 非 Y / shr 空;两级面板必须清空 node)
        check(`${P.code}/${no} 弃审后 pending≠Y、shr 空${P.l2 ? '、approve_node 空' : ''}`,
          S_(r.after.row.pending).toUpperCase() !== 'Y' && S_(r.after.row.shr) === ''
            && (!P.l2 || r.after.row.approve_node === null),
          JSON.stringify({ pending: r.after.row.pending, shr: r.after.row.shr, node: r.after.row.approve_node }))
        check(`${P.code}/${no} 留痕 UNAUDIT/PENDING(ButtonService.unaudit 口径)`, trailOf(r.appr, 'UNAUDIT', 'PENDING'),
          r.appr.map((a) => `${a.action}/${a.result}`).join(','))
        if (sig) {
          check(`${P.code}/${no} 弃审后「${sig.l1}」「${sig.l2}」清空`,
            S_(r.head[sig.l1]) === '' && S_(r.head[sig.l2]) === '', JSON.stringify({ l1: r.head[sig.l1], l2: r.head[sig.l2] }))
        }
        for (const [dp, nos] of Object.entries(downs)) {
          for (const dNo of nos) {
            const st = await docStatus(ctx.db, dp, dNo)
            check(`${P.code} 弃审联动: 下游 ${dp}/${dNo} 已作废`, st.status === '已作废', 'status=' + st.status)
          }
        }
        if (P.code === 'QC_ASM_INSP') {
          const h = await headNow()
          check(`${P.code}/${no} 弃审后「处理方式」回执清除`, S_(h['处理方式']) === '', '处理方式=' + S_(h['处理方式']))
        }
        const fin = await docStatus(ctx.db, P.code, no)
        check(`${P.code}/${no} 弃审终态=草稿`, fin.status === '草稿', 'status=' + fin.status)
      }

      /* ⑦ 还原(不留脏数据) */
      if (DO_CLEANUP) {
        log(`── 还原:${P.code}/${no} 本轮痕迹 → 测前快照 …`)
        rec.cleanup = await cleanupAndRestore(ctx.db, P, no, pre, downs)
        const c = rec.cleanup.residue
        check(`${P.code}/${no} 还原:状态回草稿`, c.statusAfter === '草稿', 'statusAfter=' + c.statusAfter)
        check(`${P.code}/${no} 还原:头行全列与测前一致`, c.headDiff.length === 0, 'diff=' + JSON.stringify(c.headDiff))
        check(`${P.code}/${no} 还原:本轮审批留痕已清除`, c.approvalLeft === 0, 'left=' + c.approvalLeft)
        for (const [dp, left] of Object.entries(c.downstreamLeft)) {
          check(`${P.code}/${no} 还原:下游 ${dp} 测试单已物理清除`, left === 0, 'left=' + left)
        }
        check(`${P.code}/${no} 还原:流程链条数恢复测前`, c.linkCountNow === c.linkCountPre, `now=${c.linkCountNow} pre=${c.linkCountPre}`)
        pre = null // 已还原,异常兜底不必重跑
      }
    } catch (e) {
      err = String(e.stack || e.message)
      log(`✗ ${P.code} 执行异常: ${err}`)
      check(`${P.code} 审核/反审核链路未完成`, false, String(e.message).slice(0, 600))
      rec.error = err
      // 异常兜底还原(若快照已建立)
      if (DO_CLEANUP && pre && no) {
        try {
          log(`── 异常兜底还原:${P.code}/${no} …`)
          const ds = downs || await newDownstream(ctx.db, P, no, pre)
          rec.errorCleanup = await cleanupAndRestore(ctx.db, P, no, pre, ds)
          const c = rec.errorCleanup.residue
          check(`${P.code}/${no} 异常兜底还原:状态回草稿 + 头行一致`,
            c.statusAfter === '草稿' && c.headDiff.length === 0, JSON.stringify({ st: c.statusAfter, diff: c.headDiff }))
        } catch (e2) {
          rec.errorCleanup = { error: String(e2.message) }
          check(`${P.code} 异常兜底还原失败`, false, String(e2.message).slice(0, 400))
        }
      }
    }
    rec.assertions = checks.slice(startCheck)
    rec.pass = rec.assertions.filter((x) => x.ok === true).length
    rec.fail = rec.assertions.filter((x) => x.ok === false).length
    summary.push({
      panel: P.code, name: P.name, docNo: rec.docNo, l2: P.l2, error: rec.error || null,
      pass: rec.pass, fail: rec.fail,
      cleanup: rec.cleanup ? rec.cleanup.residue : (rec.errorCleanup ? rec.errorCleanup.residue : null),
    })
    await saveJson(path.join(OUT, `${P.code}.json`), rec)
    log(`── 已保存 ${P.code}.json(累计 PASS=${PASS} FAIL=${FAIL})`)
    CURRENT_PANEL = null
  }

  /* 汇总 */
  log('\n══════════════════ 汇总 ══════════════════')
  for (const s of summary) {
    const clean = s.cleanup
      ? (s.cleanup.headDiff.length === 0 && s.cleanup.statusAfter === '草稿' ? '已还原' : '还原待查:' + JSON.stringify(s.cleanup.headDiff))
      : '未还原'
    log(`${s.panel.padEnd(16)} doc=${(s.docNo || '-').padEnd(16)} ${s.error ? 'ERROR: ' + s.error.slice(0, 100) : '审核+反审核通过'}  ${clean}`)
  }
  log(`\nRESULT: ${FAIL === 0 ? 'PASS' : 'FAIL'}  (PASS ${PASS} / FAIL ${FAIL})`)
  await saveJson(path.join(OUT, 'summary.json'), {
    base: BASE, factory: FACTORY, db: 'HSDZ_MES_TEST', stamp: STAMP,
    result: FAIL === 0 ? 'PASS' : 'FAIL', pass: PASS, fail: FAIL,
    panels: summary.map((s) => ({
      panel: s.panel, name: s.name, docNo: s.docNo, l2: s.l2, auditAndUnaudit: s.error ? 'ERROR' : 'PASS',
      error: s.error, pass: s.pass, fail: s.fail,
      cleanupOk: !!s.cleanup && s.cleanup.headDiff.length === 0 && s.cleanup.statusAfter === '草稿',
    })),
    checks,
  })
  await saveText(path.join(OUT, 'run.log'), LOG.join('\n') + '\n')
  log('[evidence] ' + OUT)
} finally {
  try { if (ctx.db) await ctx.db.close() } catch { /* ignore */ }
}
process.exit(FAIL === 0 ? 0 : 2)
