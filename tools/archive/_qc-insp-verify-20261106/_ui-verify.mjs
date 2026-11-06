/**
 * _ui-verify.mjs —— 三项需求的 Playwright UI 断言(8091 新前端;可只读,也可填值+保存)
 *
 * 任务模式(--task):
 *   t1-proc-draft : 制程检验单草稿纸面 —— 表头无「工序」、检验方案为固定只读文本「出货控制计划执行」、
 *                   明细「结果判断」是 el-select(合格/不合格);可 --fill 选「不合格」并 --save 落库
 *   t2-oqc-draft  : 出厂检验报告草稿 —— 「产品编码」是输入框(可填+保存);报告编号/检验员/审核/批准只读文本;
 *                   抬头其余字段控件清单 + 明细/卫生/结论/备注可填清单
 *   t3-paper      : 制程/首件纸面审批态断言(草稿/待二级审批/已审核)—— 侧栏按钮 + 表尾
 *                   检验人/审核人/批准 落值
 *
 * 用法示例:
 *   node _ui-verify.mjs --base http://127.0.0.1:8091 --factory YJ_TEST --panel QC_PROC_INSP \
 *     --docNo ZC-2026-11-0001 --task t1-proc-draft --fill '{"结果判断":"不合格"}' --save \
 *     --out evidence/t1 --prefix ui-t1
 *
 * 输出: <out>/<prefix>.json + <prefix>-result.txt + <prefix>-*.png
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { ROOT, Results, saveJson, saveText, requireE2E, sleep } from './_lib.mjs'

const { chromium } = requireE2E('playwright')
const args = process.argv.slice(2)
const arg = (n, d) => {
  const eq = args.find((a) => a.startsWith('--' + n + '='))
  if (eq) return eq.slice(n.length + 3)
  const i = args.indexOf('--' + n)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const flag = (n) => args.includes('--' + n)
const BASE = String(arg('base', 'http://127.0.0.1:8091')).replace(/\/$/, '')
const FACTORY = String(arg('factory', 'YJ_TEST'))
const PANEL_CODE = String(arg('panel', 'QC_PROC_INSP'))
const DOC_NO = String(arg('docNo', ''))
const TASK = String(arg('task', 't3-paper'))
const STATE = String(arg('state', '')) // t3: draft | pending2 | audited
const USER = String(arg('user', 'admin'))
const PASSWORD = String(arg('password', '123456'))
const OUT = path.resolve(ROOT, String(arg('out', 'tools/archive/_qc-insp-verify-20261106/evidence/ui')))
const PREFIX = String(arg('prefix', TASK))
const FILL = (() => { try { return JSON.parse(String(arg('fill', '{}'))) } catch { return {} } })()
const DO_SAVE = flag('save')
const EXPECT = {
  preparer: String(arg('expect-preparer', '')),
  l1: String(arg('expect-l1', '')),
  l2: String(arg('expect-l2', '')),
}
fs.mkdirSync(OUT, { recursive: true })
const r = new Results(`UI ${TASK}${STATE ? '/' + STATE : ''} @ ${BASE} panel=${PANEL_CODE} doc=${DOC_NO || '(新建)'}`)
r.fact('参数', { base: BASE, factory: FACTORY, panel: PANEL_CODE, docNo: DOC_NO, task: TASK, state: STATE, fill: FILL, save: DO_SAVE, outDir: OUT })

const sheetSelector = { QC_PROC_INSP: '.qr-sheet', QC_FIRST_INSP: '.fi-sheet', QC_OQC_REPORT: '.oqc-sheet' }[PANEL_CODE] || '.qr-sheet'
const shot = async (page, name) => {
  const f = path.join(OUT, `${PREFIX}-${name}.png`)
  await page.screenshot({ path: f, fullPage: false })
  return f
}

/** 通用的「标签 th → 下一个 td」控件形态 */
function controlFactsJs() {
  return () => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const kindOf = (td) => {
      if (!td) return 'none'
      if (td.querySelector('.el-date-editor')) return 'date'
      if (td.querySelector('.el-input-number')) return 'number'
      if (td.querySelector('.el-select')) return 'select'
      if (td.querySelector('input,textarea')) return 'input'
      if (td.querySelector('.oqc-ro,.qr-cell-text,.fi-ro')) return 'text'
      return 'unknown'
    }
    const map = {}
    // 逐张表配对 th/td(按 DOM 顺序:一行内 th td th td ...)
    for (const table of document.querySelectorAll('.qr-head-table, .oqc-head, .fi-head-table, .fi-foot, .qr-foot-table')) {
      for (const tr of table.querySelectorAll('tr')) {
        const kids = [...tr.children]
        for (let i = 0; i < kids.length - 1; i++) {
          if (kids[i].tagName === 'TH') {
            const label = txt(kids[i])
            const nextTd = kids[i].nextElementSibling
            if (nextTd && nextTd.tagName === 'TD') map[label] = { kind: kindOf(nextTd), text: txt(nextTd) }
          }
        }
      }
    }
    return map
  }
}

try {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, locale: 'zh-CN', acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)) })

  // ── 登录 ──
  await page.goto(BASE + '/#/login', { waitUntil: 'domcontentloaded' })
  await page.locator('.login-form').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByPlaceholder('请输入登录账号').fill(USER)
  await page.getByPlaceholder('请输入登录密码').fill(PASSWORD)
  await page.evaluate(() => {
    const wrap = [...document.querySelectorAll('.login-form .el-select')].find((s) => !s.className.includes('locale-select'))
    const inp = wrap?.querySelector('.el-select__wrapper') || wrap
    inp?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(700)
  const picked = await page.evaluate((factory) => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((el) => {
      const ov = el.closest('.el-select-dropdown, .el-popper')
      return ov ? getComputedStyle(ov).display !== 'none' : true
    })
    // 工厂代码 YJ_TEST(或显示名含「测试」)→ 选「…测试库」;否则正式库 YINJIA-MES
    const want = (/测试|YJ_TEST/i).test(factory) ? /测试库/ : /^YINJIA-MES$/
    const t = items.find((x) => want.test((x.textContent || '').trim()))
    if (!t) return { ok: false, texts: items.map((x) => (x.textContent || '').trim()) }
    t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return { ok: true, picked: (t.textContent || '').trim() }
  }, FACTORY)
  r.check('UI 登录工厂选中 ' + FACTORY, picked.ok, JSON.stringify(picked))
  const wantTest = /测试|YJ_TEST/i.test(FACTORY)
  r.check('UI 登录工厂与期望账套一致(' + (wantTest ? '测试库' : '正式库') + ')',
    picked.ok && (wantTest ? /测试库/.test(picked.picked || '') : (picked.picked || '') === 'YINJIA-MES'), 'picked=' + (picked.picked || ''))
  await page.locator('.login-submit').click()
  let loginOk = true
  try { await page.waitForURL(/#\/dashboard/, { timeout: 20000 }) } catch { loginOk = false }
  r.check('UI 登录成功并进入桌面', loginOk, page.url())

  // ── 打开纸张面板(深链) ──
  if (DOC_NO) {
    const url = BASE + '/#/panelx/list/' + PANEL_CODE + '?docNo=' + encodeURIComponent(DOC_NO)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
  } else {
    await page.goto(BASE + '/#/panelx/list/' + PANEL_CODE, { waitUntil: 'domcontentloaded' })
  }
  let sheetOk = true
  try { await page.locator(sheetSelector).first().waitFor({ state: 'visible', timeout: 30000 }) } catch { sheetOk = false }
  await sleep(600) // 基础渲染;真正的数据载入由后面的 waitForFunction 兜底
  r.check('纸张面板已渲染(' + sheetSelector + ')', sheetOk, page.url())

  // 纸张数据是异步载入的(面板配置 → 列表查询 → 单据头/明细渲染),固定 sleep 不可靠:
  //   ① 先等"侧栏出现保存按钮 + 纸张里出现本单号"(= 配置和单据都载入完成;30s 上限)
  //   ② 再等明细行/关键控件(结果判断下拉等)出现
  const rowWaitSel = PANEL_CODE === 'QC_OQC_REPORT'
    ? '.oqc-grid tbody tr'
    : PANEL_CODE === 'QC_FIRST_INSP' ? '.fi-sheet table tbody tr' : '.qr-grid tbody tr'
  if (DOC_NO) {
    try {
      await page.waitForFunction((docNo) => {
        const txt = (el) => (el?.textContent || '').trim()
        const hasSave = [...document.querySelectorAll('.as-side-btn')].some((x) => txt(x) === '保存')
        const sheet = document.querySelector('.qr-sheet, .fi-sheet, .oqc-sheet')
        return hasSave && !!sheet && (sheet.textContent || '').includes(docNo)
      }, DOC_NO, { timeout: 30000 })
    } catch { r.fact('UI 等待单据载入超时', 'DOC_NO=' + DOC_NO) }
  }
  try { await page.waitForFunction((s) => document.querySelectorAll(s).length > 0, rowWaitSel, { timeout: 15000 }) } catch { /* 空表也允许 */ }
  if (TASK === 't1-proc-draft') {
    try { await page.waitForSelector('.qr-grid tbody td.c-verdict .el-select', { timeout: 15000 }) } catch { /* ignore */ }
  }
  await sleep(1200)
  const sideFacts = async () => page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    return {
      sideBtns: [...document.querySelectorAll('.as-side-btn')].map(txt),
      disabledBtns: [...document.querySelectorAll('.as-side-btn.disabled')].map(txt),
      status: txt(document.querySelector('.as-side-status, .doc-status')),
    }
  })

  const collectPanelFacts = async () => page.evaluate((selector) => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const sheet = document.querySelector(selector)
    return { paperText: txt(sheet).slice(0, 2000) }
  }, sheetSelector)

  /** 文档输出 → 导出 → 导出 Excel(.xlsx):捕获浏览器下载并落盘(前端纸张 Excel 导出) */
  async function exportSheetExcel() {
    const out = { clickedSide: false, dialogText: '', clickedItem: false, downloadPath: null, error: '' }
    try {
      out.clickedSide = await page.evaluate(() => {
        const el = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '导出')
        if (!el) return false
        el.click(); return true
      })
      await sleep(1500)
      out.dialogText = await page.evaluate(() => {
        const overlays = [...document.querySelectorAll('.el-overlay')].filter((o) => getComputedStyle(o).display !== 'none')
        const d = overlays.map((o) => o.querySelector('.el-dialog')).filter(Boolean).pop()
        const scope = d || document.body
        return (scope.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400)
      })
      const dlP = page.waitForEvent('download', { timeout: 40000 }).catch(() => null)
      const clickRes = await page.evaluate(() => {
        const overlays = [...document.querySelectorAll('.el-overlay')].filter((o) => getComputedStyle(o).display !== 'none')
        const d = overlays.map((o) => o.querySelector('.el-dialog')).filter(Boolean).pop()
        const scope = d || document.body
        const cands = [...scope.querySelectorAll('div,button,a,span')]
          .filter((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().startsWith('导出 Excel') && (e.textContent || '').length < 80)
        const t = cands[cands.length - 1]
        if (!t) return { ok: false }
        t.click(); return { ok: true }
      })
      out.clickedItem = !!clickRes.ok
      const dl = await dlP
      if (dl) {
        const p = path.join(OUT, PREFIX + '-sheet-export.xlsx')
        await dl.saveAs(p)
        out.downloadPath = p
      } else out.error = '未捕获下载事件'
    } catch (e) { out.error = String(e.message).slice(0, 300) }
    return out
  }

  /* ═══════════════ T1:制程检验单草稿纸面 ═══════════════ */
  if (TASK === 't1-proc-draft') {
    const facts = await page.evaluate(() => {
      const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
      const kindOf = (td) => {
        if (!td) return 'none'
        if (td.querySelector('.el-date-editor')) return 'date'
        if (td.querySelector('.el-select')) return 'select'
        if (td.querySelector('input,textarea')) return 'input'
        if (td.querySelector('.qr-cell-text')) return 'text'
        return 'unknown'
      }
      const labels = [...document.querySelectorAll('.qr-head-table .qr-label')].map(txt)
      const map = {}
      for (const tr of document.querySelectorAll('.qr-head-table tr')) {
        const kids = [...tr.children]
        for (let i = 0; i < kids.length - 1; i++) {
          if (kids[i].tagName === 'TH') {
            const td = kids[i].nextElementSibling
            if (td && td.tagName === 'TD') {
              map[txt(kids[i])] = { kind: kindOf(td), text: txt(td) }
            }
          }
        }
      }
      const grid = document.querySelector('.qr-grid')
      const rows = grid ? [...grid.querySelectorAll('tbody tr')] : []
      const dataRows = rows.filter((tr) => !tr.querySelector('.c-empty'))
      const verdictSelects = dataRows.map((tr) => !!tr.querySelector('td.c-verdict .el-select'))
      // el-select 内部也有 input(EP 结构)⇒ 判"普通输入框"要看 td 内是否有 el-input 组件(非 select)
      const verdictInputs = dataRows.map((tr) => !!tr.querySelector('td.c-verdict .el-input'))
      // 表尾:检验人/审核人/批准
      const foot = {}
      for (const tr of document.querySelectorAll('.qr-foot-table tr')) {
        const kids = [...tr.children]
        for (let i = 0; i < kids.length - 1; i++) {
          if (kids[i].tagName === 'TH') {
            const td = kids[i].nextElementSibling
            if (td && td.tagName === 'TD') foot[txt(kids[i])] = txt(td)
          }
        }
      }
      return {
        headLabels: labels,
        hasGongxu: labels.includes('工序'),
        headControls: map,
        docNoKind: map['单据编号'] ? map['单据编号'].kind : null,
        hasWorkOrderRowNo: labels.includes('工单行号'),
        planKind: map['检验方案'] ? map['检验方案'].kind : null,
        planText: map['检验方案'] ? map['检验方案'].text : '',
        hasInspectorInput: !!document.querySelector('.qr-insp-input'),
        rowCount: dataRows.length,
        verdictSelects, verdictInputs,
        foot,
        paperText: txt(document.querySelector('.qr-sheet')).slice(0, 1500),
      }
    })
    const side = await sideFacts()
    const shotPaper = await shot(page, 'paper')
    r.fact('制程纸面事实', { ...facts, ...side, shot: shotPaper, errors })
    r.check('T1[UI] 表头**没有**「工序」', !facts.hasGongxu, '表头标签=' + facts.headLabels.join('|'))
    r.check('T1[UI] 「检验方案」是只读文本(不是输入框)', facts.planKind === 'text',
      'kind=' + facts.planKind + ' 文本=' + facts.planText)
    r.check('T1[UI] 「检验方案」固定显示「出货控制计划执行」', facts.planText.includes('出货控制计划执行'), '文本=' + facts.planText)
    r.check('T1[UI] 「单据编号」按元数据只读(纯文本,非输入框)', facts.docNoKind === 'text', 'kind=' + facts.docNoKind)
    r.check('T1[UI] 「工单行号」(hidden=1)不进纸面表头', !facts.hasWorkOrderRowNo, '表头=' + facts.headLabels.join('|'))
    r.check('T1[UI] 「检验员」草稿态仍可编辑(回归:不能被 isLocked 误锁)', facts.hasInspectorInput === true,
      'hasInspectorInput=' + facts.hasInspectorInput)
    r.check('T1[UI] 明细「结果判断」是 el-select 下拉(非普通输入框)',
      facts.verdictSelects.length > 0 && facts.verdictSelects.every(Boolean) && facts.verdictInputs.every((x) => !x),
      `行数=${facts.rowCount} select=${JSON.stringify(facts.verdictSelects)} input=${JSON.stringify(facts.verdictInputs)}`)

    // 选「不合格」+ 保存(真实 Playwright 点击;失败再退回 DOM 事件)
    if (FILL['结果判断']) {
      let target = false
      try {
        await page.locator('.qr-grid tbody tr td.c-verdict .el-select').first().click({ timeout: 8000 })
        target = true
      } catch {
        target = await page.evaluate(() => {
          const sel = document.querySelector('.qr-grid tbody tr td.c-verdict .el-select')
          if (!sel) return false
          ; (sel.querySelector('.el-select__wrapper') || sel).dispatchEvent(new MouseEvent('click', { bubbles: true }))
          return true
        })
      }
      await sleep(800)
      let optionClicked = false
      try {
        const opt = page.locator('.el-select-dropdown__item').filter({ hasText: FILL['结果判断'] }).last()
        await opt.click({ timeout: 6000 })
        optionClicked = true
      } catch { /* JS 兜底 */ }
      if (!optionClicked) {
        const js = await page.evaluate((val) => {
          const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((el) => {
            const ov = el.closest('.el-select-dropdown, .el-popper')
            return (ov ? getComputedStyle(ov).display !== 'none' : true) && (el.textContent || '').trim() === val
          })
          const t = items[items.length - 1]
          if (!t) return { ok: false, seen: [...document.querySelectorAll('.el-select-dropdown__item')].map((x) => (x.textContent || '').trim()).slice(0, 12) }
          t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          return { ok: true }
        }, FILL['结果判断'])
        optionClicked = !!js.ok
        if (!optionClicked) r.fact('T1[UI] 下拉候选项', js)
      }
      r.check('T1[UI] 「结果判断」下拉选中「' + FILL['结果判断'] + '」', target && optionClicked,
        `target=${target} optionClicked=${optionClicked}`)
      await sleep(600)
      const afterPick = await page.evaluate(() => {
        const sel = document.querySelector('.qr-grid tbody tr td.c-verdict .el-select')
        return (sel?.textContent || '').replace(/\s+/g, ' ').trim()
      })
      r.check('T1[UI] 结果判断格显示已选值 = ' + FILL['结果判断'], afterPick.includes(FILL['结果判断']), '格内文本=' + afterPick)
    }
    if (DO_SAVE) {
      const respP = page.waitForResponse((res) => res.url().includes('/api/px/callButton') && res.request().method() === 'POST', { timeout: 30000 }).catch(() => null)
      const clicked = await page.evaluate(() => {
        const el = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '保存')
        if (!el) return false
        el.click(); return true
      })
      const resp = await respP
      let body = null
      try { body = resp ? await resp.json() : null } catch { /* ignore */ }
      const msg = await page.evaluate(() => {
        const m = [...document.querySelectorAll('.el-message__content')].pop()
        return m ? (m.textContent || '').trim() : ''
      })
      r.check('T1[UI] 点击侧栏「保存」并收到 callButton 响应',
        clicked && !!resp && resp.status() === 200 && (body?.code === 200 || body?.code === 0),
        `clicked=${clicked} http=${resp ? resp.status() : 'null'} body=${JSON.stringify(body).slice(0, 200)} msg=${msg}`)
      await sleep(1200)
      const shotSaved = await shot(page, 'saved')
      r.fact('T1[UI] 保存后截图', shotSaved)
      // 保存后 DB 值由父脚本断言;此处再抓一次纸面显示
      const afterSave = await page.evaluate(() => {
        const sel = document.querySelector('.qr-grid tbody tr td.c-verdict .el-select')
        return (sel?.textContent || '').replace(/\s+/g, ' ').trim()
      })
      r.fact('T1[UI] 保存后结果判断格显示', afterSave)
    }
    if (flag('export-excel')) {
      const ex = await exportSheetExcel()
      r.check('T1[UI] 前端「导出→导出 Excel」下载成功(纸张 Excel)', !!ex.downloadPath, JSON.stringify(ex).slice(0, 300))
      r.fact('T1[UI] 纸张 Excel 导出证据', ex)
    }
  }

  /* ═══════════════ T2:出厂检验报告草稿 ═══════════════ */
  if (TASK === 't2-oqc-draft') {
    const facts = await page.evaluate(() => {
      const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
      const kindOf = (td) => {
        if (!td) return 'none'
        if (td.querySelector('.el-date-editor')) return 'date'
        if (td.querySelector('.el-input-number')) return 'number'
        if (td.querySelector('.el-select')) return 'select'
        if (td.querySelector('input,textarea')) return 'input'
        if (td.querySelector('.oqc-ro')) return 'text'
        return 'unknown'
      }
      const heads = {}
      const rows = [...document.querySelectorAll('.oqc-head tr')]
      for (const tr of rows) {
        const kids = [...tr.children]
        for (let i = 0; i < kids.length - 1; i++) {
          if (kids[i].tagName === 'TH') {
            const td = kids[i].nextElementSibling
            if (td) heads[txt(kids[i])] = { kind: kindOf(td), text: txt(td) }
          }
        }
      }
      // 产品编码整行(独占一行:th + td colspan3)
      const allTh = [...document.querySelectorAll('.oqc-head th')]
      const pth = allTh.find((x) => txt(x) === '产品编码')
      const ptd = pth?.nextElementSibling
      const productCode = ptd ? { kind: kindOf(ptd), text: txt(ptd) } : null
      // 签署区
      const sign = [...document.querySelectorAll('.oqc-sign-item')].map(txt)
      const signInputs = [...document.querySelectorAll('.oqc-sign-input')].length
      // 明细行可填控件 + 结论/备注 + 卫生
      const gridInputs = [...document.querySelectorAll('.oqc-grid tbody td input, .oqc-grid tbody td textarea')].length
      const hygieneInputs = [...document.querySelectorAll('.oqc-hygiene-input')].length
      const sumRow = [...document.querySelectorAll('.oqc-sum-row td input, .oqc-sum-row td textarea')].length
      const remarkRow = [...document.querySelectorAll('.oqc-remark-row td input, .oqc-remark-row td textarea')].length
      const detailRows = [...document.querySelectorAll('.oqc-grid tbody tr')].length
      return {
        heads, productCode, sign, signInputs, gridInputs, hygieneInputs, sumRow, remarkRow, detailRows,
        hasReportNoInput: heads['报告编号'] ? heads['报告编号'].kind === 'input' : null,
        paperText: txt(document.querySelector('.oqc-sheet')).slice(0, 1500),
      }
    })
    const side = await sideFacts()
    const shotPaper = await shot(page, 'paper')
    r.fact('出厂检验报告纸面事实', { ...facts, ...side, shot: shotPaper, errors })
    r.check('T2[UI] 「产品编码」是输入框(草稿态可填)', !!facts.productCode && facts.productCode.kind === 'input',
      JSON.stringify(facts.productCode))
    r.check('T2[UI] 「报告编号」只读文本', facts.heads['报告编号'] && facts.heads['报告编号'].kind === 'text',
      JSON.stringify(facts.heads['报告编号']))
    r.check('T2[UI] 签署区 检验员/审核/批准 只读文本(无输入框)',
      facts.signInputs === 0 && facts.sign.length === 3, `signInputs=${facts.signInputs} sign=${JSON.stringify(facts.sign)}`)
    r.check('T2[UI] 抬头其余字段草稿态可填(客户名/产品名称/产品规格/生产量/AQL 输入框;生产日期/检测日期 日期控件)',
      ['客户名', '产品名称', '产品规格', '生产量', 'AQL'].every((k) => facts.heads[k] && ['input', 'number'].includes(facts.heads[k].kind)) &&
      ['生产日期', '检测日期'].every((k) => facts.heads[k] && facts.heads[k].kind === 'date'),
      JSON.stringify(facts.heads))
    r.check('T2[UI] 明细/检验结论/备注/卫生安全 草稿态可填',
      facts.gridInputs > 0 && facts.sumRow > 0 && facts.remarkRow > 0 && facts.hygieneInputs === 15,
      `明细行=${facts.detailRows} 明细控件=${facts.gridInputs} 结论=${facts.sumRow} 备注=${facts.remarkRow} 卫生=${facts.hygieneInputs}`)
    r.fact('T2[UI] 可填写控件清单', {
      抬头: facts.heads, 产品编码: facts.productCode,
      明细控件数: facts.gridInputs, 检验结论控件: facts.sumRow, 备注控件: facts.remarkRow, 卫生安全控件: facts.hygieneInputs,
      签署区: facts.sign,
    })

    if (FILL['产品编码']) {
      let filled = false
      try {
        const row = page.locator('.oqc-head tr').filter({ hasText: '产品编码' }).last()
        await row.locator('td input, td textarea').first().fill(String(FILL['产品编码']), { timeout: 8000 })
        filled = true
      } catch {
        filled = await page.evaluate((val) => {
          const allTh = [...document.querySelectorAll('.oqc-head th')]
          const pth = allTh.find((x) => (x.textContent || '').trim() === '产品编码')
          const ptd = pth?.nextElementSibling
          const inp = ptd?.querySelector('input,textarea')
          if (!inp) return false
          inp.focus()
          inp.value = val
          inp.dispatchEvent(new Event('input', { bubbles: true }))
          inp.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        }, FILL['产品编码'])
      }
      r.check('T2[UI] 在「产品编码」输入框填入 ' + FILL['产品编码'], filled)
      await sleep(500)
      const shown = await page.evaluate(() => {
        const allTh = [...document.querySelectorAll('.oqc-head th')]
        const pth = allTh.find((x) => (x.textContent || '').trim() === '产品编码')
        const ptd = pth?.nextElementSibling
        const inp = ptd?.querySelector('input,textarea')
        return inp ? inp.value : (ptd ? (ptd.textContent || '').trim() : '')
      })
      r.check('T2[UI] 输入后格内值正确', shown === String(FILL['产品编码']), '格内=' + shown)
    }
    if (DO_SAVE) {
      const respP = page.waitForResponse((res) => res.url().includes('/api/px/callButton') && res.request().method() === 'POST', { timeout: 30000 }).catch(() => null)
      const clicked = await page.evaluate(() => {
        const el = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '保存')
        if (!el) return false
        el.click(); return true
      })
      const resp = await respP
      let body = null
      try { body = resp ? await resp.json() : null } catch { /* ignore */ }
      const msg = await page.evaluate(() => {
        const m = [...document.querySelectorAll('.el-message__content')].pop()
        return m ? (m.textContent || '').trim() : ''
      })
      r.check('T2[UI] 点击侧栏「保存」并收到 callButton 响应',
        clicked && !!resp && resp.status() === 200 && (body?.code === 200 || body?.code === 0),
        `clicked=${clicked} http=${resp ? resp.status() : 'null'} body=${JSON.stringify(body).slice(0, 200)} msg=${msg}`)
      await sleep(1200)
      const shotSaved = await shot(page, 'saved')
      r.fact('T2[UI] 保存后截图', shotSaved)
    }
  }

  /* ═══════════════ T3:制程/首件审批态纸面 ═══════════════ */
  if (TASK === 't3-paper') {
    const facts = await page.evaluate((selector) => {
      const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
      const sheet = document.querySelector(selector)
      const look = (tableSel) => {
        const out = {}
        const table = document.querySelector(tableSel)
        if (!table) return out
        for (const tr of table.querySelectorAll('tr')) {
          const kids = [...tr.children]
          for (let i = 0; i < kids.length - 1; i++) {
            if (kids[i].tagName === 'TH') {
              const td = kids[i].nextElementSibling
              if (td && td.tagName === 'TD') out[txt(kids[i])] = txt(td)
            }
          }
        }
        return out
      }
      return {
        paperText: txt(sheet).slice(0, 2000),
        qrFoot: look('.qr-foot-table'),
        fiFoot: look('.fi-foot'),
        oqcSign: [...document.querySelectorAll('.oqc-sign-val')].map(txt),
        sheetEmpty: !sheet,
      }
    }, sheetSelector)
    const side = await sideFacts()
    const shotPaper = await shot(page, 'paper')
    r.fact('审批态纸面事实', { ...facts, ...side, shot: shotPaper, errors })
    const btns = side.sideBtns
    const has = (t) => btns.includes(t)
    const foot = PANEL_CODE === 'QC_PROC_INSP' ? facts.qrFoot : facts.fiFoot
    const footText = JSON.stringify(foot)
    r.fact('表尾签名格', foot)

    if (STATE === 'draft') {
      r.check('T3[UI] 草稿态:侧栏有「提交审批」', has('提交审批'), '侧栏=' + btns.join('/'))
      r.check('T3[UI] 草稿态:侧栏**无**「审核」直审入口(直审已撤)', !has('审核'), '侧栏=' + btns.join('/'))
      r.check('T3[UI] 草稿态:表尾 审核人/批准 无落值',
        !(foot['审核人'] || '').trim() && !(foot['批准'] || '').trim(), footText)
    } else if (STATE === 'pending2') {
      r.check('T3[UI] 待二级审批态:侧栏按钮文案=批准通过/批准驳回', has('批准通过') && has('批准驳回'), '侧栏=' + btns.join('/'))
      r.check('T3[UI] 待二级审批态:表尾「审核人」= 一级审批人 ' + EXPECT.l1,
        (foot['审核人'] || '').includes(EXPECT.l1), footText)
      r.check('T3[UI] 待二级审批态:表尾「批准」仍为空', !(foot['批准'] || '').trim(), footText)
    } else if (STATE === 'audited') {
      r.check('T3[UI] 已审核态:侧栏无「提交审批」', !has('提交审批'), '侧栏=' + btns.join('/'))
      r.check('T3[UI] 已审核态:表尾「审核人」= 一级审批人 ' + EXPECT.l1, (foot['审核人'] || '').includes(EXPECT.l1), footText)
      r.check('T3[UI] 已审核态:表尾「批准」= 超级管理员 ' + EXPECT.l2, (foot['批准'] || '').includes(EXPECT.l2), footText)
      r.check('T3[UI] 已审核态:表尾「检验人」= 编制/检验人 ' + EXPECT.preparer, !EXPECT.preparer || (foot['检验人'] || '').includes(EXPECT.preparer), footText)
    } else if (STATE === 'rejected') {
      r.check('T3[UI] 驳回回草稿:表尾 审核人/批准 已清空',
        !(foot['审核人'] || '').trim() && !(foot['批准'] || '').trim(), footText)
    }
  }

  const summary = r.summary()
  summary.env = { base: BASE, factory: FACTORY, panel: PANEL_CODE, docNo: DOC_NO, task: TASK, state: STATE, outDir: OUT }
  await saveJson(path.join(OUT, PREFIX + '.json'), summary)
  await saveText(path.join(OUT, PREFIX + '-result.txt'),
    summary.items.map((i) => `${i.ok === null ? 'FACT' : i.ok ? 'PASS' : 'FAIL'}  ${i.name}${i.detail ? '  -- ' + i.detail : ''}`).join('\n')
    + `\n\nRESULT: ${summary.result} (PASS ${summary.pass} / FAIL ${summary.fail})\n`)
  await browser.close()
  process.exitCode = summary.fail === 0 ? 0 : 1
} catch (e) {
  console.error('[FATAL]', e.stack || e.message)
  const summary = r.summary()
  summary.fatal = String(e.stack || e.message).slice(0, 1200)
  await saveJson(path.join(OUT, PREFIX + '-fatal.json'), summary).catch(() => {})
  process.exitCode = 2
}
