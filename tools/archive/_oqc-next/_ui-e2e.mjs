/**
 * _ui-e2e.mjs —— 出厂检验报告 纸张面板 UI 端到端(Playwright,2026-11-04,task-4)
 *
 * 覆盖:
 *   ① 真实 UI 登录(账号/密码/登录工厂下拉 → 桌面)
 *   ② 打开 #/panelx/list/QC_OQC_REPORT?docNo=<单号> 的纸张面板
 *   ③ 纸面断言:.oqc-footer 有无、签署行(检验员/审核/批准)落值、检验员是否可输入
 *   ④ 侧栏按钮:直审入口(审核/弃审)有无、提交审批/批准通过/批准驳回 文案
 *   ⑤ 导出报表弹窗:模板下拉含「出厂检验报告」;导出 PDF(捕获 /api/report/export 响应 + %PDF-)
 *   ⑥ 打印预览(同端点,断言 disposition=inline 或新窗口/请求已发起)
 *   ⑦ 导出 → 导出 Excel(.xlsx)(捕获 xlsx 响应 + PK 头)
 *
 * 两种模式:
 *   --expect=old  旧 jar(8090)基线:要求 .oqc-footer 存在、页脚文字命中、侧栏有 审核/弃审
 *   --expect=new  新 jar(8091,阶段 B):要求 .oqc-footer 不存在、无 审核/弃审;
 *                 配合 --state=draft|pending2|audited 断言按钮文案与签署落值
 *
 * 用法:
 *   node tools/archive/_oqc-next/_ui-e2e.mjs --base http://127.0.0.1:8090 --expect=old \
 *        --docNo OQC-2026-11-0004 --out tools/archive/_oqc-next/baseline/20261104-ui-old --prefix ui-old
 *   node tools/archive/_oqc-next/_ui-e2e.mjs --base http://127.0.0.1:8091 --expect=new \
 *        --docNo AUTO_OQC-... --state=draft --audit-name=... --approve-name=... \
 *        --out tools/archive/_oqc-next/phaseB/ui --prefix ui-draft
 *
 * 注意:本脚本只读 + 触发导出,不保存/提交任何单据。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Results, ROOT, saveJson, saveText } from './_lib.mjs'

const requireE2E = createRequire(ROOT + '/tests/e2e/')
const { chromium } = requireE2E('playwright')

const args = process.argv.slice(2)
const arg = (name, def) => {
  const eq = args.find((a) => a.startsWith('--' + name + '='))
  if (eq) return eq.slice(name.length + 3)
  const i = args.indexOf('--' + name)
  if (i < 0) return def
  const v = args[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const BASE = String(arg('base', 'http://127.0.0.1:8090')).replace(/\/$/, '')
const FACTORY = String(arg('factory', 'YINJIA-MES'))
const DOC_NO = String(arg('docNo', 'OQC-2026-11-0004'))
const EXPECT = String(arg('expect', 'old')) // old | new
const STATE = String(arg('state', '')) // draft | pending2 | audited(阶段 B)
const AUDIT_NAME = String(arg('audit-name', ''))
const APPROVE_NAME = String(arg('approve-name', ''))
const PREPARER_NAME = String(arg('preparer-name', ''))
const ADMIN_PLACEHOLDER = String(arg('approve-name', '')) || '系统管理员'
const OUT_DIR = path.resolve(ROOT, String(arg('out', 'tools/archive/_oqc-next/baseline/ui')))
const PREFIX = String(arg('prefix', 'ui-' + EXPECT))
fs.mkdirSync(OUT_DIR, { recursive: true })
const shot = async (page, name) => {
  const f = path.join(OUT_DIR, `${PREFIX}-${name}.png`)
  await page.screenshot({ path: f, fullPage: false })
  return f
}

const r = new Results(`OQC UI ${EXPECT}${STATE ? '/' + STATE : ''} @ ${BASE} docNo=${DOC_NO}`)
r.fact('参数', { base: BASE, factory: FACTORY, docNo: DOC_NO, expect: EXPECT, state: STATE, outDir: OUT_DIR })

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))
let browser
try {
  browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, locale: 'zh-CN', acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)) })

  // ── ① UI 登录 ──
  await page.goto(BASE + '/#/login', { waitUntil: 'domcontentloaded' })
  await page.locator('.login-form').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByPlaceholder('请输入登录账号').fill('admin')
  await page.getByPlaceholder('请输入登录密码').fill('123456')
  r.check('登录页可见(frontend 可访问)', true, BASE + '/#/login')

  // 登录工厂下拉:选指定 factory(下拉项文案 = 工厂显示名;按 factory code 优先,退化按文本)
  await page.evaluate((factory) => {
    const wrap = [...document.querySelectorAll('.login-form .el-select')].find((s) => !s.className.includes('locale-select'))
    const inp = wrap?.querySelector('.el-select__wrapper') || wrap
    inp?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, FACTORY)
  await sleep(800)
  const pickedFactory = await page.evaluate((factory) => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((el) => {
      const ov = el.closest('.el-select-dropdown, .el-popper')
      return ov ? getComputedStyle(ov).display !== 'none' : true
    })
    const texts = items.map((x) => (x.textContent || '').trim())
    // 'YINJIA-MES' 与 'YINJIA-MES·测试库' 同时存在:精确等于 code 的优先;否则含 code 的第一个
    let target = items.find((x) => (x.textContent || '').trim() === factory) || items.find((x) => (x.textContent || '').includes(factory))
    if (!target) return { ok: false, texts }
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return { ok: true, picked: (target.textContent || '').trim(), texts }
  }, FACTORY)
  r.check('登录工厂下拉选中 ' + FACTORY, !!pickedFactory.ok, JSON.stringify(pickedFactory))
  await page.locator('.login-submit').click()
  try {
    await page.waitForURL(/#\/dashboard/, { timeout: 20000 })
    r.check('UI 登录成功并进入桌面(#/dashboard)', true, page.url())
  } catch {
    r.check('UI 登录成功并进入桌面(#/dashboard)', false, page.url())
  }

  // ── ② 打开纸张面板(按 docNo 深链;列表数据可能为空,不依赖左栏点击) ──
  const panelUrl = BASE + '/#/panelx/list/QC_OQC_REPORT?docNo=' + encodeURIComponent(DOC_NO)
  await page.goto(panelUrl, { waitUntil: 'domcontentloaded' })
  let sheetOk = true
  try {
    await page.locator('.approval-layout .oqc-sheet, .oqc-sheet').first().waitFor({ state: 'visible', timeout: 25000 })
  } catch { sheetOk = false }
  await sleep(2500) // 等纸面数据渲染完(单据头/明细异步)
  const facts = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const qa = (s) => [...document.querySelectorAll(s)]
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const paper = q('.oqc-sheet')
    const footer = q('.oqc-footer')
    // 签署行:找含「检验员」且非整纸大容器的最近元素
    const signEl = paper ? [...paper.querySelectorAll('div,td,span')].filter((e) => (e.textContent || '').includes('检验员：') && (e.textContent || '').trim().length < 120).pop() : null
    return {
      hash: location.hash,
      hasApprovalLayout: !!q('.approval-layout'),
      hasSheet: !!paper,
      hasFooter: !!footer,
      footerText: txt(footer),
      signText: txt(signEl),
      signValues: qa('.oqc-sign-val').map(txt),
      blankCells: qa('.oqc-blank').length,
      sheetInputs: qa('.oqc-sheet input').length,
      preparerInput: !!qa('.oqc-sheet input').find((i) => (i.closest('td,div')?.textContent || '').includes('检验员')),
      sideBtns: qa('.as-side-btn').map(txt),
      disabledBtns: qa('.as-side-btn.disabled').map(txt),
      paperText: txt(paper).slice(0, 1500),
      titleText: txt(q('.doc-chip')),
    }
  })
  r.check('打开纸张面板(.oqc-sheet 渲染)', facts.hasSheet && sheetOk, `hash=${facts.hash} approvalLayout=${facts.hasApprovalLayout}`)
  const png = await shot(page, 'paper')
  r.fact('纸面截图', png)
  r.fact('纸面事实', {
    hasFooter: facts.hasFooter, footerText: facts.footerText, signText: facts.signText,
    signValues: facts.signValues, blankCells: facts.blankCells, sheetInputs: facts.sheetInputs,
    preparerInput: facts.preparerInput, sideBtns: facts.sideBtns, disabledBtns: facts.disabledBtns,
  })

  // ── ③ 纸面断言(按模式) ──
  const FOOTER_MARKS = ['water-agplus', '惠州大亚湾', '5583930']
  const sideHas = (name) => facts.sideBtns.some((t) => t === name)
  if (EXPECT === 'old') {
    r.check('基线:纸面存在 .oqc-footer', facts.hasFooter)
    r.check('基线:页脚含 water-agplus/惠州大亚湾/5583930',
      FOOTER_MARKS.every((m) => facts.footerText.replace(/\s+/g, '').includes(m)), facts.footerText.slice(0, 120))
    r.check('基线:侧栏有直审入口 审核/弃审', sideHas('审核') && sideHas('弃审'), facts.sideBtns.join('/'))
    r.check('基线:签署行 审核/批准 为空白线(无落值)',
      !/审核：\S+/.test(facts.signText) && !/批准：\S+/.test(facts.signText) && facts.blankCells >= 2,
      `signText=${facts.signText.slice(0, 80)} blankCells=${facts.blankCells}`)
  } else {
    r.check('新口径:纸面不存在 .oqc-footer', !facts.hasFooter, 'footerText=' + facts.footerText.slice(0, 80))
    // 直审入口:必须没有「审核」;「弃审」在已审核态由**统一审批组**放出(task-2 设计:
    // hasApprovalBtns += QC_OQC_REPORT,反审核走审批组而非 DIRECT_AUDIT_PANELS),故按状态记录。
    r.check('新口径:侧栏无「审核」直审入口', !sideHas('审核'), '侧栏=' + facts.sideBtns.join('/'))
    r.fact('弃审按钮是否存在(统一审批组,按状态显隐)', sideHas('弃审'))
    // 审批按钮按状态
    if (STATE === 'draft') {
      r.check('草稿态:有「提交审批」按钮', sideHas('提交审批'), '侧栏=' + facts.sideBtns.join('/'))
      r.check('草稿态:无可用「弃审」入口(统一审批组按节点显隐;草稿态若显示则必须 disabled)',
        !sideHas('弃审') || facts.disabledBtns.includes('弃审'), '弃审 disabled=' + facts.disabledBtns.includes('弃审'))
      r.check('草稿态:签署行 检验员/审核/批准 无落值', !facts.signValues.some((v) => v && v !== '') && !facts.paperText.includes('审核：系统管理员'), 'signValues=' + JSON.stringify(facts.signValues))
    } else if (STATE === 'pending2') {
      r.check('待二级审批态:按钮文案=批准通过/批准驳回', sideHas('批准通过') && sideHas('批准驳回'), '侧栏=' + facts.sideBtns.join('/'))
      r.check('待二级审批态:无可用「弃审」入口(未审核完成)', !sideHas('弃审') || facts.disabledBtns.includes('弃审'), '弃审 disabled=' + facts.disabledBtns.includes('弃审'))
      r.check('待二级审批态:审核格已落一级审批人', facts.signValues.includes(AUDIT_NAME) || facts.paperText.includes('审核：' + AUDIT_NAME), 'signValues=' + JSON.stringify(facts.signValues))
      r.check('待二级审批态:批准格仍无落值', !facts.paperText.includes('批准：' + APPROVE_NAME) && !facts.signValues[2], 'signValues=' + JSON.stringify(facts.signValues))
    } else if (STATE === 'audited') {
      r.check('已审核态:无 提交审批/审批通过(单据已终态)', !sideHas('提交审批'), '侧栏=' + facts.sideBtns.join('/'))
      r.check('已审核态:签署行 检验员/审核/批准 三格均已落值(= ' + ADMIN_PLACEHOLDER + ')',
        facts.signValues.length >= 3 && facts.signValues.every((v) => v === ADMIN_PLACEHOLDER) && !facts.blankCells,
        'signValues=' + JSON.stringify(facts.signValues) + ' blankCells=' + facts.blankCells)
    }
    // 检验员只读(无 input)
    r.check('检验员格只读(纸面无 检验员 input)', !facts.preparerInput, `sheetInputs=${facts.sheetInputs} preparerInput=${facts.preparerInput}`)
    // 姓名落值断言只在本状态应有的格上做(草稿态尚未提交,三格皆空)
    if (STATE !== 'draft') {
      if (PREPARER_NAME) r.check('检验员格显示编制人 = ' + PREPARER_NAME, facts.paperText.includes(PREPARER_NAME), '')
      if (AUDIT_NAME) r.check('审核格显示一级审批人 = ' + AUDIT_NAME, facts.paperText.includes(AUDIT_NAME), '')
    }
    if (STATE === 'audited' && APPROVE_NAME) r.check('批准格显示超级管理员 = ' + APPROVE_NAME, facts.paperText.includes(APPROVE_NAME), '')
  }

  // ── ④ 导出报表弹窗:模板下拉含「出厂检验报告」 ──
  const clickSide = async (name) => page.evaluate((n) => {
    const el = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === n)
    if (!el) return false
    el.click(); return true
  }, name)
  const visibleDialog = () => page.evaluate(() => {
    const overlays = [...document.querySelectorAll('.el-overlay')].filter((o) => getComputedStyle(o).display !== 'none')
    const d = overlays.map((o) => o.querySelector('.el-dialog')).filter(Boolean).pop()
    if (!d) return null
    return {
      text: (d.textContent || '').replace(/\s+/g, ' ').trim(),
      buttons: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').trim()),
      selects: [...d.querySelectorAll('.el-select')].map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim()),
    }
  })
  await clickSide('导出报表')
  await sleep(1200)
  const reportDlg = await visibleDialog()
  r.check('「导出报表」弹窗打开', !!reportDlg, reportDlg ? reportDlg.text.slice(0, 80) : '')
  r.check('弹窗模板下拉含「出厂检验报告」', !!reportDlg && /出厂检验报告/.test(reportDlg.text), reportDlg?.selects?.join(' | ') || '')
  r.check('弹窗有 导出 PDF / 打印预览 / 导出 Excel 三项',
    !!reportDlg && /导出 PDF/.test(reportDlg.text) && /打印预览/.test(reportDlg.text) && /导出 Excel/.test(reportDlg.text), reportDlg?.buttons?.join('/') || '')
  await shot(page, 'dialog-report')

  // ── ⑤ 导出 PDF:捕获 /api/report/export 响应 ──
  const captureExport = async (triggerText, formatHint) => {
    const wait = page.waitForResponse((res) => res.url().includes('/api/report/export') && res.status() === 200, { timeout: 20000 }).catch(() => null)
    const clicked = await page.evaluate(({ text, dialogText }) => {
      const overlays = [...document.querySelectorAll('.el-overlay')].filter((o) => getComputedStyle(o).display !== 'none')
      const d = overlays.map((o) => o.querySelector('.el-dialog')).filter(Boolean).pop()
      const scope = d || document
      const cands = [...scope.querySelectorAll('div,button,a,span')].filter((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().startsWith(text) && (e.textContent || '').length < 80)
      const target = cands[cands.length - 1]
      if (!target) return { ok: false, seen: [...scope.querySelectorAll('div,button,a,span')].map((e) => (e.textContent || '').trim()).filter((t) => t && t.length < 40).slice(0, 40) }
      target.click()
      return { ok: true, text: (target.textContent || '').trim() }
    }, { text: triggerText, dialogText: 'x' })
    const res = await wait
    let buf = null
    if (res) { try { buf = Buffer.from(await res.body()) } catch { buf = null } }
    return { clicked, res, buf }
  }
  // 弹窗里点「导出 PDF」
  const pdfCap = await captureExport('导出 PDF')
  if (pdfCap.res && pdfCap.buf) {
    const f = path.join(OUT_DIR, `${PREFIX}-export.pdf`)
    fs.writeFileSync(f, pdfCap.buf)
    r.check('导出报表→导出 PDF:命中 /api/report/export 且 %PDF-',
      pdfCap.buf.subarray(0, 5).toString('latin1') === '%PDF-' && pdfCap.buf.length > 10 * 1024,
      `url=${pdfCap.res.url().slice(0, 160)} bytes=${pdfCap.buf.length} file=${f}`)
    r.fact('导出 PDF 证据', f)
  } else {
    r.check('导出报表→导出 PDF:命中 /api/report/export 且 %PDF-', false, '未捕获响应 ' + JSON.stringify(pdfCap.clicked).slice(0, 200))
  }

  // ── ⑥ 打印预览:同端点,断言请求已发起(content-disposition=inline 或新窗口) ──
  await sleep(800)
  // 可能弹窗已关;重新打开导出报表
  if (!(await visibleDialog())) { await clickSide('导出报表'); await sleep(1000) }
  let previewInfo = { ok: false }
  try {
    const newPageP = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null)
    const wait = page.waitForResponse((res) => res.url().includes('/api/report/export'), { timeout: 20000 }).catch(() => null)
    const clicked = await page.evaluate(() => {
      const overlays = [...document.querySelectorAll('.el-overlay')].filter((o) => getComputedStyle(o).display !== 'none')
      const d = overlays.map((o) => o.querySelector('.el-dialog')).filter(Boolean).pop()
      const scope = d || document
      const cands = [...scope.querySelectorAll('div,button,a,span')].filter((e) => (e.textContent || '').trim().startsWith('打印预览') && (e.textContent || '').length < 80)
      const target = cands[cands.length - 1]
      if (!target) return false
      target.click(); return true
    })
    const [res, newPage] = await Promise.all([wait, newPageP])
    const disp = res ? res.headers()['content-disposition'] || '' : ''
    previewInfo = { clicked, hasRes: !!res, url: res?.url().slice(0, 160), disposition: disp, newPage: !!newPage, status: res?.status() }
    r.check('打印预览:发起 /api/report/export 请求', !!res, JSON.stringify(previewInfo))
    r.check('打印预览:disposition=inline 或打开新窗口', /inline/i.test(disp) || !!newPage, 'disposition=' + disp + ' newPage=' + !!newPage)
  } catch (e) {
    r.check('打印预览:发起 /api/report/export 请求', false, e.message.slice(0, 200))
  }
  await shot(page, 'preview')

  // ── ⑦ 导出 → 导出 Excel(.xlsx) ──
  // 先关掉可能剩下的弹窗(ESC),再点侧栏「导出」
  await page.keyboard.press('Escape').catch(() => {})
  await sleep(500)
  await clickSide('导出')
  await sleep(1200)
  const expDlg = await visibleDialog()
  r.check('「导出」弹窗打开(选择导出格式)', !!expDlg, expDlg?.text.slice(0, 100) || '')
  r.check('「导出」弹窗含 导出 Excel（.xlsx）', !!expDlg && /导出 Excel/.test(expDlg.text), expDlg?.text.slice(0, 120) || '')
  const xlCap = await captureExport('导出 Excel')
  if (xlCap.res && xlCap.buf) {
    const f = path.join(OUT_DIR, `${PREFIX}-export.xlsx`)
    fs.writeFileSync(f, xlCap.buf)
    r.check('导出→导出 Excel:命中 /api/report/export 且 PK 头',
      xlCap.buf.subarray(0, 2).toString('latin1') === 'PK', `url=${xlCap.res.url().slice(0, 160)} bytes=${xlCap.buf.length} file=${f}`)
    r.fact('导出 XLSX 证据', f)
  } else {
    r.check('导出→导出 Excel:命中 /api/report/export 且 PK 头', false, '未捕获 xlsx 响应 ' + JSON.stringify(xlCap.clicked).slice(0, 200))
  }
  await shot(page, 'dialog-export')
  if (errors.length) r.fact('页面 JS 错误', errors.slice(0, 10))

  // ── 汇总 ──
  const summary = r.summary()
  summary.env = { base: BASE, factory: FACTORY, docNo: DOC_NO, expect: EXPECT, state: STATE, outDir: OUT_DIR }
  await saveJson(path.join(OUT_DIR, `${PREFIX}.json`), summary)
  await saveText(path.join(OUT_DIR, `${PREFIX}-result.txt`),
    summary.items.map((i) => `${i.ok === null ? 'FACT' : i.ok ? 'PASS' : 'FAIL'}  ${i.name}${i.detail ? '  -- ' + i.detail : ''}`).join('\n') + `\n\nRESULT: ${summary.result} (PASS ${summary.pass} / FAIL ${summary.fail})\n`)
  process.exit(summary.fail === 0 ? 0 : 1)
} catch (e) {
  console.error('[FATAL]', e.stack || e.message)
  try { if (browser) await browser.close() } catch { /* ignore */ }
  process.exit(2)
} finally {
  try { if (browser) await browser.close() } catch { /* ignore */ }
}
