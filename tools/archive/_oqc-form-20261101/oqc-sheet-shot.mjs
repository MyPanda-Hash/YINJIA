/**
 * oqc-sheet-shot.mjs —— 出厂检验报告「纸张式记录表」验证(2026-11-01 第三轮)
 *   ① 打开 5173 的面板页(注入登录态),截图:外壳 + 左单据选择栏 + 纸面居中 + 右按钮竖栏
 *   ② 纸面整张截图(clip 到 .oqc-sheet:抬头/主表 15 行/结论/备注/卫生安全/签署/页脚)
 *   ③ 结构化断言:可编辑控件数量、明细行数、卫生安全行数、侧栏按钮、左栏列
 *
 * 用法: node oqc-sheet-shot.mjs [base] [docNo] [locale]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:5173'
const DOC = process.argv[3] || 'OQC-2026-11-0003'
const LOCALE = process.argv[4] || 'zh-CN'
const FACTORY = process.env.FACTORY || 'YJ_TEST'
const SUFFIX = process.env.SUFFIX || (LOCALE === 'zh-CN' ? 'oqc-sheet' : 'oqc-sheet-' + LOCALE)
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
})).json()
const token = login?.data?.token
const user = login?.data?.user
if (!token) { console.log('登录失败'); process.exit(1) }

const write = async (name, b64) => {
  if (!b64) return console.log('[shot][FAIL]', name)
  await fs.writeFile(HERE + name, Buffer.from(b64, 'base64'))
  console.log('[shot]', name)
}

const s = await launch({ port: 9474 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(1800)
  await s.evaluate(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
    localStorage.setItem('mes_factory', JSON.stringify({ code: '${FACTORY}', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_locale', ${JSON.stringify(LOCALE)})
    return 'ok'
  })()`)
  await s.evaluate(`(() => { location.href = ${JSON.stringify(BASE + '/#/panelx/list/QC_OQC_REPORT?docNo=' + encodeURIComponent(DOC))}; location.reload(); return 1 })()`)
  await sleep(11000)

  const st = await s.evaluate(`(() => {
    const txt = (el) => (el?.textContent || '').trim()
    const q = (sel) => document.querySelector(sel)
    const paper = q('.oqc-sheet')
    const grid = q('.oqc-grid')
    const rows = [...(grid?.querySelectorAll('tbody > tr') || [])]
    const detailRows = rows.filter((r) => r.querySelectorAll('td').length === 7)
    const rail = q('.doc-select-rail')
    return {
      hash: location.hash,
      isApprovalLayout: !!q('.approval-layout'),
      hasPaper: !!paper,
      paperWidth: paper ? Math.round(paper.getBoundingClientRect().width) : 0,
      paperHeight: paper ? Math.round(paper.getBoundingClientRect().height) : 0,
      // 抬头
      headCells: paper ? [...paper.querySelectorAll('.oqc-head th')].map(txt) : [],
      headValues: paper ? [...paper.querySelectorAll('.oqc-head td')].map(txt) : [],
      // 主表
      gridHead: grid ? [...grid.querySelectorAll('thead th')].map(txt) : [],
      detailRowCount: detailRows.length,
      firstRow: detailRows[0] ? [...detailRows[0].querySelectorAll('td')].map((td) => (td.querySelector('textarea,input') ? '[' + (td.querySelector('textarea,input').value || '') + ']' : txt(td))) : [],
      lastRow: detailRows.length ? [...detailRows[detailRows.length - 1].querySelectorAll('td')].map((td) => (td.querySelector('textarea,input') ? '[' + (td.querySelector('textarea,input').value || '') + ']' : txt(td))) : [],
      sumRow: [...(grid?.querySelectorAll('tbody > tr') || [])].filter((r) => r.querySelector('th')).map((r) => [...r.children].map((c) => txt(c) || (c.querySelector('input,textarea')?.value ?? '')).join(' | ')),
      // 卫生安全
      hygieneTitle: txt(q('.oqc-hygiene-title')),
      hygieneHeader: [...(q('.oqc-hygiene-table')?.querySelectorAll('thead th') || [])].map(txt),
      hygieneRows: q('.oqc-hygiene-table') ? q('.oqc-hygiene-table').querySelectorAll('tbody tr').length : 0,
      hygieneFirst: [...(q('.oqc-hygiene-table')?.querySelectorAll('tbody tr')[0]?.children || [])].map(txt),
      hygieneLast: [...(q('.oqc-hygiene-table')?.querySelectorAll('tbody tr')[14]?.children || [])].map(txt),
      // 签署 / 页脚
      sign: txt(q('.oqc-sign')),
      signInputs: [...(q('.oqc-sign')?.querySelectorAll('input') || [])].map((x) => x.value),
      formNo: txt(q('.oqc-form-no')),
      footer: txt(q('.oqc-footer')),
      // 可编辑控件统计
      inputs: paper ? paper.querySelectorAll('input').length : 0,
      textareas: paper ? paper.querySelectorAll('textarea').length : 0,
      // 外壳
      sideBtns: [...document.querySelectorAll('.as-side-btn')].map(txt),
      railTitle: txt(q('.doc-select-rail .dsr-title, .doc-select-rail')),
      railHeads: rail ? [...rail.querySelectorAll('th')].map(txt) : [],
      railRows: rail ? rail.querySelectorAll('tbody tr').length : 0,
      toolsVisible: !!q('.tools') && q('.tools').offsetParent !== null,
      // 打印白名单类是否在
      printCssLoaded: [...document.styleSheets].some((ss) => { try { return [...ss.cssRules].some((r) => String(r.cssText || '').includes('.oqc-sheet')); } catch { return false } }),
    }
  })()`)
  console.log('[state]', JSON.stringify(st, null, 1).slice(0, 6000))

  // ① 视口截图(外壳 + 左栏 + 纸面 + 右栏)
  const shot1 = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await write(SUFFIX + '-1.png', shot1?.result?.data)

  // ② 纸面整张:把视口拉高到整张纸够高再截(纸在 .portal-content 内部滚动容器里,
  //    captureBeyondViewport+clip 会因内层滚动算错坐标 ⇒ 改成"拉高视口 + 事后按 rect 裁").
  await s.evaluate(`(() => { document.querySelector('.portal-content')?.scrollTo(0, 0); return 1 })()`)
  await sleep(400)
  const rect = await s.evaluate(`(() => {
    const el = document.querySelector('.oqc-sheet')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.max(0, Math.round(r.left + window.scrollX)), y: Math.max(0, Math.round(r.top + window.scrollY)), width: Math.round(r.width), height: Math.round(r.height) }
  })()`)
  console.log('[paper rect]', JSON.stringify(rect))
  if (rect && rect.width && rect.height) {
    await s.send('Emulation.setDeviceMetricsOverride', {
      width: 1680, height: Math.min(4000, rect.y + rect.height + 40), deviceScaleFactor: 1, mobile: false,
    })
    await sleep(600)
    const shot2 = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const rawName = '_' + SUFFIX + '-full.png'
    await write(rawName, shot2?.result?.data)
    // 按 rect 裁出纸面(python PIL;bundled python 自带 Pillow)
    const py = '"D:/deepseek harness/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe"'
    const crop = `from PIL import Image\nim = Image.open(${JSON.stringify(HERE + rawName)})\nim.crop((${rect.x}, ${rect.y}, ${rect.x + rect.width}, ${rect.y + rect.height})).save(${JSON.stringify(HERE + SUFFIX + '-paper.png')})\nprint('[crop] ok')\n`
    const fsSync = await import('node:fs')
    fsSync.writeFileSync(HERE + '_crop.py', crop)
    const { execSync } = await import('node:child_process')
    try { execSync(`${py} ${JSON.stringify(HERE + '_crop.py')}`, { stdio: 'inherit' }) } catch (e) { console.log('[crop][FAIL]', e.message) }
  }

  // ③ 编辑态抽样:点一个检验要求 textarea 改内容 → 直接改值验证 v-model 链路(不改业务数据,改完撤销)
  const editProbe = await s.evaluate(`(() => {
    const paper = document.querySelector('.oqc-sheet')
    const tas = [...paper.querySelectorAll('.oqc-grid textarea')]
    const first = tas[0]
    if (!first) return { ok: false, reason: 'no textarea' }
    const before = first.value
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    first.dispatchEvent(new Event('focus'))
    setter.call(first, before + 'X')
    first.dispatchEvent(new Event('input', { bubbles: true }))
    return { ok: true, before: before.slice(0, 40), textareaCount: tas.length,
      heights: tas.slice(0, 4).map((t) => Math.round(t.getBoundingClientRect().height)) }
  })()`)
  console.log('[edit-probe]', JSON.stringify(editProbe))
  await sleep(600)
  const dirty = await s.evaluate(`[...document.querySelectorAll('.el-message')].map((x) => (x.textContent || '').trim())`)
  console.log('[messages after edit]', JSON.stringify(dirty))
  // 撤销(evaluate 里改的是 DOM 值,组件状态已跟着变;刷新页面回到服务端数据)
  await s.evaluate(`(() => { location.reload(); return 1 })()`)
  await sleep(9000)
  const restored = await s.evaluate(`(() => { const t = document.querySelector('.oqc-grid textarea'); return t ? t.value.slice(0, 20) : '' })()`)
  console.log('[after reload first textarea]', JSON.stringify(restored))
  await s.close?.()
} finally { process.exit(0) }
