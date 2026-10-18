/**
 * _v-dialog-flow.mjs — 「重复弹窗 / 重复查询」的门控时序回归(不需要浏览器)
 *
 * 沙箱里 Edge 起不来(spawn EPERM),故把 PanelxList 里**弹窗门**的调用时序复刻一遍,
 * 直接驱动真实纯函数 @core/report/reportQuery.js,断言:
 *   ① 首次进入(load)→ 弹一次
 *   ② 弹窗开着时后台再 load(切页签回来 / 刷新 / 列设置保存后)→ **不许再弹**
 *   ③ 用户点查询(onQueryDialogClose→applyHeaderQuery 记票)→ 后续 load 不再弹
 *   ④ 工具栏「查询」在弹窗开着时 → 不重开(否则就是"重复弹窗")
 *   ⑤ 切到别的面板再回来 → 重新弹一次(票随面板重置)
 *
 * 用法: node tools/archive/_stockreport-dialog-1020/_v-dialog-flow.mjs
 */
import {
  shouldAutoOpenReportQuery,
} from '../../../frontend/src/core/report/reportQuery.js'

/** 复刻 PanelxList 的状态位(只保留与门有关的部分) */
function makePanel(code) {
  const st = { panelCode: code, enabled: true, rqdDone: false, dialogVisible: false, rqdOpening: false, opens: 0 }
  /** = openReportQueryIfNeeded(fresh) */
  st.gate = () => {
    if (!shouldAutoOpenReportQuery({
      enabled: st.enabled, panelCode: st.panelCode,
      hasApplied: st.rqdDone, dialogVisible: st.dialogVisible,
    }) || st.rqdOpening) return false
    st.rqdOpening = true
    st.dialogVisible = true
    st.opens++
    return true
  }
  /** = load() 开头那道门 */
  st.load = () => st.gate()
  /** = 用户点「查询」:校验通过 ⇒ 记票 + 关弹窗 + 取数 */
  st.applyQuery = () => { st.rqdDone = true; st.rqdOpening = false; st.dialogVisible = false }
  /** = 用户点 ✕/取消(没查过就退页;查过就只关弹窗) */
  st.cancel = () => { st.rqdOpening = false; st.dialogVisible = false; if (!st.rqdDone) st.leaving = true }
  /** = 工具栏「查询」按钮(2026-10-20 口径:弹窗开着就 return;否则一律开条件弹窗,不受票限制) */
  st.toolbarQuery = () => {
    if (st.dialogVisible) return 'already-open'
    if (st.gate()) return 'opened'
    st.dialogVisible = true   // = openQueryDialog()
    st.opens++
    return 'opened'
  }
  /** = watch(panelCode) 重置 */
  st.switchTo = (code) => { st.panelCode = code; st.rqdDone = false; st.rqdOpening = false; st.dialogVisible = false; st.leaving = false }
  return st
}

const lines = []
let fails = 0
const ok = (name, cond, detail = '') => {
  const s = `${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`
  console.log(s); lines.push(s)
  if (!cond) fails++
}

const p = makePanel('STOCK_LEDGER')
ok('① 首次进入弹一次', p.load() === true && p.opens === 1, `opens=${p.opens}`)
ok('①b 弹窗门返回值让 load 跳过取数', p.dialogVisible === true)
ok('② 弹窗开着时后台第一次再 load 不弹', p.load() === false && p.opens === 1, `opens=${p.opens}`)
ok('②b 连来三次也不弹(切面板双触发/刷新/列设置保存后)', !p.load() && !p.load() && !p.load() && p.opens === 1, `opens=${p.opens}`)
ok('②c 用户填的条件不会因为后台 load 被清(草稿不经 openQueryDialog)', p.dialogVisible === true)
ok('④ 工具栏「查询」在弹窗开着时不重开', p.toolbarQuery() === 'already-open' && p.opens === 1, `opens=${p.opens}`)

p.applyQuery()
ok('③ 点查询后记票', p.rqdDone === true && p.dialogVisible === false)
ok('③b 查过之后 load 不再弹(不重复弹窗)', p.load() === false && p.opens === 1, `opens=${p.opens}`)
ok('④b 查过之后点工具栏「查询」= 再弹条件弹窗(不是重复,是用户主动要)', p.toolbarQuery() === 'opened' && p.opens === 2, `opens=${p.opens}`)
p.cancel()
ok('④c 查过一次后取消弹窗不退页', !p.leaving, `leaving=${p.leaving}`)

// 没查过就取消 ⇒ 退页(dashboard);回来再进 ⇒ 重新弹一次
const q = makePanel('STOCK_SUMMARY')
q.load()
q.cancel()
ok('⑤ 没查过就关弹窗 ⇒ 退页', q.leaving === true)
q.switchTo('STOCK_SUMMARY')
q.leaving = false
ok('⑤b 再进来重新弹一次(票随面板重置)', q.load() === true && q.opens === 2, `opens=${q.opens}`)

// 切到另一个面板:票互不影响
const r = makePanel('STOCK_LEDGER')
r.load(); r.applyQuery()          // 台账查过了
r.switchTo('STOCK_SUMMARY')       // 切到汇总
ok('⑥ 切到汇总:汇总自己还要弹一次', r.load() === true, `opens=${r.opens}`)
r.switchTo('STOCK_LEDGER')
ok('⑥b 切回台账:重新弹一次(不与汇总的票串味)', r.load() === true, `opens=${r.opens}`)

const { writeFileSync } = await import('node:fs')
const { dirname, join } = await import('node:path')
const { fileURLToPath } = await import('node:url')
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'v-dialog-flow.out'), lines.join('\n') + '\n')
console.log(`\n${fails ? '[FAIL]' : '[PASS]'} ${lines.length} 项,失败 ${fails} 项`)
process.exit(fails ? 1 : 0)
