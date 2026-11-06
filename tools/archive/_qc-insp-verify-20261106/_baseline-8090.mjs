/**
 * _baseline-8090.mjs —— 改动前基线取证(宿主 8090 旧 jar;**只读**,不重启/不换 jar/不写单)
 *
 * 取证口径:
 *   · 8090 是旧 jar(旧后端 class + 旧打包前端);数据库用**登录工厂 YJ_TEST = HSDZ_MES_TEST**
 *     —— 测试库在阶段 1 尚未执行本轮迁移,故 8090 + 测试账套 = 纯「改动前」状态
 *     (正式库 HSDZ_MES 在 2026-11-06 12:00 前已被 Lead/be-dev 先执行了迁移,不再适合做改前基线)。
 *   · API:自签 YJ_TEST 令牌(不写登录使用记录),抓 getPanelConfig 字段形态 + 三张报表 PDF 文本。
 *   · UI:Playwright 真实登录(账号口令+登录工厂下拉选「YINJIA-MES·测试库」),深链打开纸张只读断言:
 *       T1 制程纸面有「工序」、检验方案是输入框、明细结果判断是普通输入框(非下拉);
 *       T2 出厂检验报告「产品编码」是只读文本(span)不是输入框;
 *       T3 制程/首件侧栏:无「提交审批」,有「审核 / 弃审」(管理员直审入口)。
 *     只读打开,绝不点保存/审批。
 *
 * 用法:node tools/archive/_qc-insp-verify-20261106/_baseline-8090.mjs [--base http://127.0.0.1:8090]
 * 产物:evidence/stage1/baseline-8090-<时间戳>.{json,txt} + 截图/PDF/PDF文本
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import {
  ROOT, Results, signToken, api, pdfText, saveJson, saveText, norm, nowStamp,
  evidenceDir, requireE2E, sleep,
} from './_lib.mjs'

const { chromium } = requireE2E('playwright')
const args = process.argv.slice(2)
const arg = (n, d) => {
  const eq = args.find((a) => a.startsWith('--' + n + '='))
  if (eq) return eq.slice(n.length + 3)
  const i = args.indexOf('--' + n)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const BASE = String(arg('base', 'http://127.0.0.1:8090')).replace(/\/$/, '')
const STAMP = nowStamp()
const OUT = evidenceDir('stage1')
const PREFIX = 'baseline-8090-' + STAMP
const DOC_PROC = String(arg('proc-doc', 'ZC-2026-10-0126'))
const DOC_FIRST = String(arg('first-doc', 'SJ-2026-10-0152'))
const DOC_OQC = String(arg('oqc-doc', 'OQC-2026-11-0004'))
const r = new Results('改动前基线 @ 8090 旧 jar (YJ_TEST/HSDZ_MES_TEST) ' + STAMP)
r.fact('参数', { base: BASE, procDoc: DOC_PROC, firstDoc: DOC_FIRST, oqcDoc: DOC_OQC })

/* ───────────────── ① API 基线(自签 YJ_TEST,只读) ───────────────── */
const cli = api(BASE, signToken('admin', 'YJ_TEST'))
const cfgSummary = {}
try {
  for (const pc of ['QC_PROC_INSP', 'QC_FIRST_INSP', 'QC_OQC_REPORT']) {
    const d = (await cli.getJson('/api/px/getPanelConfig?panelCode=' + pc)).data
    const fm = new Map((d.dataSchema?.fields || []).map((f) => [f.dataName, f]))
    const pick = (name) => {
      const f = fm.get(name)
      return f ? { dataType: f.dataType, readonly: !!f.readonly, hidden: !!f.hidden, options: f.options || null, isRequired: !!f.isRequired } : null
    }
    cfgSummary[pc] = {
      工序: pick('工序'), 检验方案: pick('检验方案'), 结果判断: pick('结果判断'),
      产品编码: pick('产品编码'), 检验员: pick('检验员'), 审核人: pick('审核人'), 审批人: pick('审批人'),
      buttonGroups: (d.metadata?.buttonGroups || []).map((g) => g.name + ':' + (g.actions || []).join('/')),
    }
  }
  r.fact('8090 getPanelConfig(旧后端 + 测试库未迁移元数据)', cfgSummary)
  // T1 断言:旧口径 —— 工序可见;检验方案可编辑(非 readonly);结果判断是文本
  r.check('8090 基线:T1 制程「工序」可见(hidden!=true)', cfgSummary.QC_PROC_INSP.工序 && cfgSummary.QC_PROC_INSP.工序.hidden !== true,
    JSON.stringify(cfgSummary.QC_PROC_INSP.工序))
  r.check('8090 基线:T1 制程「检验方案」可编辑(readonly!=true)', cfgSummary.QC_PROC_INSP.检验方案 && cfgSummary.QC_PROC_INSP.检验方案.readonly !== true,
    JSON.stringify(cfgSummary.QC_PROC_INSP.检验方案))
  // ⚠ 「结果判断」是**明细**字段(getPanelConfig 的 dataSchema 只下发表头字段)→ 其改动前形态由
  //   测试库 yj_field 台账(data_type=文本)+ UI 断言(普通输入框、非下拉)取证,这里只记事实。
  r.fact('8090 基线:T1 制程「结果判断」明细字段不在 getPanelConfig dataSchema(明细字段不下发);UI 断言=普通输入框', cfgSummary.QC_PROC_INSP.结果判断)
  // T2 断言:产品编码 yj_field 本来 editable(组件层面锁死);检验员只读
  r.check('8090 基线:T2 出厂检验报告「检验员」只读(readonly)', cfgSummary.QC_OQC_REPORT.检验员 && cfgSummary.QC_OQC_REPORT.检验员.readonly === true,
    JSON.stringify(cfgSummary.QC_OQC_REPORT.检验员))
} catch (e) {
  r.check('8090 API 基线可访问', false, String(e.message).slice(0, 300))
}

/* ───────────────── ② 报表 PDF 基线(旧 jar / 测试库旧模板) ───────────────── */
const pdfFacts = {}
for (const [code, pc, docNo] of [['qc_proc_insp', 'QC_PROC_INSP', DOC_PROC], ['qc_first_insp', 'QC_FIRST_INSP', DOC_FIRST]]) {
  try {
    const res = await cli.getBinary(`/api/report/export?code=${code}&panelCode=${pc}&docNo=${encodeURIComponent(docNo)}&format=pdf`)
    const pdf = path.join(OUT, `${PREFIX}-${code}.pdf`)
    const txt = path.join(OUT, `${PREFIX}-${code}.txt`)
    fs.writeFileSync(pdf, res.buf)
    if (res.status === 200 && res.buf.subarray(0, 5).toString('latin1') === '%PDF-') {
      const pt = pdfText(pdf, txt)
      const nt = norm(pt.text)
      pdfFacts[pc] = {
        status: res.status, bytes: res.buf.length, pages: pt.pages,
        hasPizhunLabel: nt.includes('批准'), hasJianyanren: nt.includes('检验人'), hasShenheren: nt.includes('审核人'),
        tailExcerpt: nt.slice(Math.max(0, nt.length - 120)),
        textFile: path.relative(ROOT, txt),
      }
      r.check(`8090 基线:${pc} 导出 PDF 可抽文本`, pt.pages >= 1 && pt.chars > 100, `pages=${pt.pages} chars=${pt.chars}`)
      if (code === 'qc_proc_insp') {
        // 旧制程模板表尾是「检验人 | 审核 | 批准」但**批准格无落值**(批准： 后面直接结束)
        r.check('8090 基线:QC_PROC_INSP 旧版表尾「批准格无落值」(批准：后没有姓名)', nt.endsWith('批准：'), '尾部=' + nt.slice(-30))
        r.check('8090 基线:QC_PROC_INSP 旧版表尾「审核格无落值」(审核：批准： 连排)', nt.includes('审核：批准：'), '')
      } else {
        r.check(`8090 基线:${pc} 旧版表尾**没有**「批准」段(本轮新增)`, !nt.includes('批准'), (nt.match(/.{0,10}批准.{0,10}/) || [''])[0])
      }
    } else {
      pdfFacts[pc] = { status: res.status, bytes: res.buf.length, error: res.buf.toString('utf8').slice(0, 200) }
      r.check(`8090 基线:${pc} 导出 PDF 可抽文本`, false, 'status=' + res.status + ' bytes=' + res.buf.length)
    }
  } catch (e) {
    pdfFacts[pc] = { error: String(e.message).slice(0, 300) }
    r.check(`8090 基线:${pc} 导出 PDF`, false, String(e.message).slice(0, 300))
  }
}
r.fact('8090 报表 PDF 基线', pdfFacts)

/* ───────────────── ③ UI 基线(旧前端;只读打开) ───────────────── */
let browser
try {
  browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, locale: 'zh-CN' })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push('console: ' + m.text().slice(0, 160)) })
  // 登录(工厂选测试库)
  await page.goto(BASE + '/#/login', { waitUntil: 'domcontentloaded' })
  await page.locator('.login-form').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByPlaceholder('请输入登录账号').fill('admin')
  await page.getByPlaceholder('请输入登录密码').fill('123456')
  await page.evaluate(() => {
    const wrap = [...document.querySelectorAll('.login-form .el-select')].find((s) => !s.className.includes('locale-select'))
    const inp = wrap?.querySelector('.el-select__wrapper') || wrap
    inp?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(800)
  const picked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((el) => {
      const ov = el.closest('.el-select-dropdown, .el-popper')
      return ov ? getComputedStyle(ov).display !== 'none' : true
    })
    const t = items.find((x) => /测试库/.test(x.textContent || ''))
    if (!t) return { ok: false, texts: items.map((x) => (x.textContent || '').trim()) }
    t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return { ok: true, picked: (t.textContent || '').trim() }
  })
  r.check('8090 UI 登录工厂下拉选中「…测试库」', picked.ok, JSON.stringify(picked))
  await page.locator('.login-submit').click()
  let loginOk = true
  try { await page.waitForURL(/#\/dashboard/, { timeout: 20000 }) } catch { loginOk = false }
  r.check('8090 UI 登录成功(旧前端)', loginOk, page.url())
  const shot = async (page, name) => {
    const f = path.join(OUT, `${PREFIX}-${name}.png`)
    await page.screenshot({ path: f, fullPage: false })
    return path.relative(ROOT, f)
  }
  const sideFacts = async (page) => page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    return {
      sideBtns: [...document.querySelectorAll('.as-side-btn')].map(txt),
      disabledBtns: [...document.querySelectorAll('.as-side-btn.disabled')].map(txt),
    }
  })

  // ---- T1 制程检验单旧纸面 ----
  await page.goto(BASE + '/#/panelx/list/QC_PROC_INSP?docNo=' + encodeURIComponent(DOC_PROC), { waitUntil: 'domcontentloaded' })
  let procSheet = true
  try { await page.locator('.qr-sheet, .oqc-sheet').first().waitFor({ state: 'visible', timeout: 25000 }) } catch { procSheet = false }
  await sleep(2500)
  const procUi = await page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const labels = [...document.querySelectorAll('.qr-head-table .qr-label')].map(txt)
    const grid = document.querySelector('.qr-grid')
    // 明细最后一列(结果判断)是否 el-select
    const rows = grid ? [...grid.querySelectorAll('tbody tr')] : []
    const lastRowCellSelect = rows.length ? [...rows[0].querySelectorAll('td')].slice(-2).some((td) => !!td.querySelector('.el-select')) : false
    const lastRowCellInput = rows.length ? [...rows[0].querySelectorAll('td')].slice(-2).some((td) => !!td.querySelector('input,textarea')) : false
    // 检验方案格:label 同名 th 的下一个 td 里是 input 还是纯文本
    let planCtl = null
    const ths = [...document.querySelectorAll('.qr-head-table th')]
    for (const th of ths) {
      if ((th.textContent || '').trim() === '检验方案') {
        const td = th.nextElementSibling
        planCtl = td ? (td.querySelector('input,textarea,.el-select') ? 'input' : 'text') : null
        break
      }
    }
    return {
      labels, hasGongxu: labels.includes('工序'), planCtl,
      procCellSelect: lastRowCellSelect, procCellInput: lastRowCellInput,
      paperText: txt(document.querySelector('.qr-sheet')).slice(0, 900),
    }
  })
  const procShot = await shot(page, 'proc-paper')
  const procSide = await sideFacts(page)
  r.check('8090 基线:T1 制程纸面已渲染', procSheet && procUi.labels.length > 0, `labels=${procUi.labels.join('|')}`)
  r.check('8090 基线:T1 制程纸面表头有「工序」(改动前)', procUi.hasGongxu, 'labels=' + procUi.labels.join('|'))
  r.check('8090 基线:T1 制程「检验方案」是输入框(改动前可编辑)', procUi.planCtl === 'input', 'planCtl=' + procUi.planCtl)
  r.check('8090 基线:T1 制程明细「结果判断」是普通输入框(非下拉)', procUi.procCellInput && !procUi.procCellSelect,
    `input=${procUi.procCellInput} select=${procUi.procCellSelect}`)
  r.check('8090 基线:T3 制程侧栏无「提交审批」(改动前走管理员直审)', !procSide.sideBtns.includes('提交审批'), '侧栏=' + procSide.sideBtns.join('/'))
  r.check('8090 基线:T3 制程侧栏有「审核」直审入口', procSide.sideBtns.includes('审核'), '侧栏=' + procSide.sideBtns.join('/'))
  r.fact('8090 制程纸面/侧栏事实', { shot: procShot, ...procSide, ...procUi })

  // ---- T3 首件检验单旧侧栏 ----
  await page.goto(BASE + '/#/panelx/list/QC_FIRST_INSP?docNo=' + encodeURIComponent(DOC_FIRST), { waitUntil: 'domcontentloaded' })
  await sleep(4000)
  const firstSide = await sideFacts(page)
  const firstShot = await shot(page, 'first-paper')
  r.check('8090 基线:T3 首件侧栏无「提交审批」', !firstSide.sideBtns.includes('提交审批'), '侧栏=' + firstSide.sideBtns.join('/'))
  r.check('8090 基线:T3 首件侧栏有「审核」直审入口', firstSide.sideBtns.includes('审核'), '侧栏=' + firstSide.sideBtns.join('/'))
  r.fact('8090 首件侧栏事实', { shot: firstShot, ...firstSide })

  // ---- T2 出厂检验报告旧纸面 ----
  await page.goto(BASE + '/#/panelx/list/QC_OQC_REPORT?docNo=' + encodeURIComponent(DOC_OQC), { waitUntil: 'domcontentloaded' })
  let oqcSheet = true
  try { await page.locator('.oqc-sheet').first().waitFor({ state: 'visible', timeout: 25000 }) } catch { oqcSheet = false }
  await sleep(2500)
  const oqcUi = await page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const head = document.querySelector('.oqc-head')
    const rows = head ? [...head.querySelectorAll('tr')] : []
    const map = {}
    for (const tr of rows) {
      const ths = [...tr.querySelectorAll('th')]
      const tds = [...tr.querySelectorAll('td')]
      ths.forEach((th, i) => {
        const td = tds[i]
        if (!td) return
        const label = txt(th)
        const input = td.querySelector('input,textarea')
        const date = td.querySelector('.el-date-editor')
        const num = td.querySelector('.el-input-number')
        const ro = td.querySelector('.oqc-ro')
        map[label] = input ? (date ? 'date' : num ? 'number' : 'input') : ro ? 'text' : 'unknown'
      })
    }
    // 产品编码整行
    const productTh = [...head.querySelectorAll('th')].find((x) => txt(x) === '产品编码')
    const productTd = productTh?.nextElementSibling
    const sig = [...document.querySelectorAll('.oqc-sign-item')].map(txt)
    return {
      headControls: map,
      productCodeTd: productTd ? {
        hasInput: !!productTd.querySelector('input,textarea'),
        roText: txt(productTd.querySelector('.oqc-ro')),
      } : null,
      sign: sig,
      signInputs: [...document.querySelectorAll('.oqc-sign-input')].length,
      sideBtns: [...document.querySelectorAll('.as-side-btn')].map(txt),
    }
  })
  const oqcShot = await shot(page, 'oqc-paper')
  r.check('8090 基线:T2 出厂检验报告纸面已渲染', oqcSheet && Object.keys(oqcUi.headControls).length > 0, JSON.stringify(oqcUi.headControls))
  r.check('8090 基线:T2 「产品编码」是只读纯文本(改动前)', oqcUi.productCodeTd && !oqcUi.productCodeTd.hasInput,
    JSON.stringify(oqcUi.productCodeTd))
  // 旧 jar 前端(早于当前源码)把「报告编号」渲染成输入框;新源码按 yj_field(单据编号 editable=0)只读。
  // 这里记录旧状态作为对照,不作为基线断言(需求判据在阶段 2 新代码上验)。
  r.fact('8090 基线:T2 「报告编号」旧 jar 渲染形态(旧前端比当前源码旧)', oqcUi.headControls['报告编号'])
  r.fact('8090 出厂检验报告纸面事实', { shot: oqcShot, ...oqcUi })
  if (consoleErrors.length) r.fact('页面 JS 错误(旧前端)', consoleErrors.slice(0, 8))

  const summary = r.summary()
  summary.env = { base: BASE, factory: 'YJ_TEST', db: 'HSDZ_MES_TEST', stamp: STAMP, outDir: OUT }
  await saveJson(path.join(OUT, PREFIX + '.json'), summary)
  await saveText(path.join(OUT, PREFIX + '-result.txt'),
    summary.items.map((i) => `${i.ok === null ? 'FACT' : i.ok ? 'PASS' : 'FAIL'}  ${i.name}${i.detail ? '  -- ' + i.detail : ''}`).join('\n')
    + `\n\nRESULT: ${summary.result} (PASS ${summary.pass} / FAIL ${summary.fail})\n`)
  process.exitCode = summary.fail === 0 ? 0 : 1
} catch (e) {
  console.error('[FATAL]', e.stack || e.message)
  const summary = r.summary()
  summary.fatal = String(e.stack || e.message).slice(0, 800)
  await saveJson(path.join(OUT, PREFIX + '-fatal.json'), summary)
  process.exitCode = 2
} finally {
  try { if (browser) await browser.close() } catch { /* ignore */ }
}
