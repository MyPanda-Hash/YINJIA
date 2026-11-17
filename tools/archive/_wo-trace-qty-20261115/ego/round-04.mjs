/**
 * round-04.mjs — Lead 侧界面取证 v2:本机 ego 的 `Page.captureScreenshot` 出不了帧
 * (about:blank 也 15s 超时 ⇒ 不是页面问题,是这台机器上 ego 的合成器不渲染),
 * 改用 **`Page.printToPDF`**(实测可用)+ PyMuPDF 转 PNG 作为视觉证据。
 *
 * 做三件事:
 *   ① DOM 断言(真实浏览器里读渲染后的表头/单元格/表尾说明/工序进度文本);
 *   ② 先注入"打印展开"CSS(把 overlay / dialog / 表格的滚动容器全部摊平,否则只印可见区);
 *   ③ printToPDF 落 PDF(供人工复核 + 后续转 PNG)。
 */
import { writeFileSync } from 'node:fs'
const EV = 'D:/workspace/yinjia/tools/archive/_wo-trace-qty-20261115/ego'
const APP = 'http://127.0.0.1:8091'

const task = await taskSpace('wo-trace-qty-20261115')
const page = task.page('p1')
const results = []
const check = (label, actual, ok) => results.push(`${ok ? '[PASS]' : '[FAIL]'} ${label} = ${JSON.stringify(actual)}`)

// ── 1. 首页 + 登录(YJ 正式库,只读) ───────────────────────────────────────────────
await page.goto(`${APP}/#/`, { timeout: 30000 })
await page.waitForTimeout(4000)
const needLogin = await page.evaluate(() =>
  [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      if (!el) return
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const sel = document.querySelector('.el-select__wrapper') || document.querySelector('.el-select')
    if (sel) sel.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(700)
  const picked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const t = items.find((it) => {
      const x = (it.textContent || '').replace(/\s+/g, '')
      return x.includes('YINJIA-MES') && !x.includes('测试')
    }) || items[0]
    if (t) { t.dispatchEvent(new MouseEvent('click', { bubbles: true })); return (t.textContent || '').trim() }
    return null
  })
  console.log('登录工厂 = ' + JSON.stringify(picked))
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
    if (b) b.click()
  })
  await page.waitForTimeout(6000)
}

// ── 2. 生产工单页 → ?focus=<行id> 自动打开该行追溯 ────────────────────────────────
await page.goto(`${APP}/#/prod/plan/workOrderList?keyword=GD-2026-11-0028-1&focus=3210`, { timeout: 45000 })
await page.waitForTimeout(10000)

const dlgTitle = await page.evaluate(() => {
  const t = document.querySelector('.el-dialog__title')
  return t ? (t.textContent || '').trim() : ''
})
check('追溯弹窗已打开(标题)', dlgTitle, dlgTitle.includes('追溯'))

// ── 3. DOM 断言 ──────────────────────────────────────────────────────────────────
const dom = await page.evaluate(() => {
  const titles = [...document.querySelectorAll('.wb-trace-block .wb-block-title')]
    .filter((el) => (el.textContent || '').trim().startsWith('完工数据'))
  const block = titles[0] ? titles[0].closest('.wb-trace-block') : null
  const tables = [...(block ? block.querySelectorAll('.el-table') : [])].map((tb) => ({
    head: [...tb.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
    rows: [...tb.querySelectorAll('.el-table__body tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
  }))
  const hit = tables.find((t) => t.head.some((h) => h.includes('报工时间')))
  const progTitle = [...document.querySelectorAll('.wb-trace-block .wb-block-title')]
    .filter((el) => (el.textContent || '').trim().startsWith('工序进度'))[0]
  const progBlock = progTitle ? progTitle.closest('.wb-trace-block') : null
  return {
    head: hit ? hit.head : [],
    rows: hit ? hit.rows : [],
    blockText: block ? (block.innerText || '').replace(/\s+/g, ' ').trim() : '',
    progText: progBlock ? (progBlock.innerText || '').replace(/\s+/g, ' ').trim() : '',
  }
})
console.log('完工数据表头 = ' + JSON.stringify(dom.head))
console.log('完工数据行 = ' + JSON.stringify(dom.rows))
console.log('工序进度段 = ' + JSON.stringify(dom.progText.slice(0, 220)))

const WANT_HEAD = ['工序', '换算率', '计划数量', '完成数量', '待审数量', '单据状态', '报工人', '报工时间']
check('列头顺序', dom.head.join('/'), dom.head.join('/') === WANT_HEAD.join('/'))
check('表尾口径说明',
  ['计划数量', '排产数量', '换算率'].every((k) => dom.blockText.includes(k)),
  ['计划数量', '排产数量', '换算率'].every((k) => dom.blockText.includes(k)))
check('工序进度 产出=50（100%）', dom.progText.includes('产出: 50（100%）'), dom.progText.includes('产出: 50（100%）'))
check('工序进度 成型 25/25', dom.progText.includes('25/25'), dom.progText.includes('25/25'))
check('工序进度 装箱 50/50', dom.progText.includes('50/50'), dom.progText.includes('50/50'))

const colIdx = (n) => dom.head.findIndex((h) => h.includes(n))
const cellOf = (op, name) => {
  const r = dom.rows.find((x) => (x[0] || '').includes(op))
  const i = colIdx(name)
  return !r || i < 0 ? undefined : r[i]
}
const numOrZero = (v) => (v === '-' || v === undefined || v === '' ? '0' : v)
for (const [op, exp] of Object.entries({
  成型: { 换算率: '0.5', 计划数量: '25', 完成数量: '25', 待审数量: '0', 单据状态: '已审核' },
  装箱: { 换算率: '1', 计划数量: '50', 完成数量: '50', 待审数量: '0', 单据状态: '已审核' },
})) {
  for (const [k, v] of Object.entries(exp)) {
    const actual = k === '待审数量' ? numOrZero(cellOf(op, k)) : cellOf(op, k)
    check(`${op}.${k}`, actual, String(actual ?? '') === v)
  }
}

// ── 4. 打印展开:overlay/dialog/表格滚动容器全部摊平(否则 printToPDF 只印可见区) ──────
await page.evaluate(() => {
  const st = document.createElement('style')
  st.id = 'e2e-print-expand'
  st.textContent = `
    body > :not(.el-overlay){display:none!important}
    body > .el-overlay{position:static!important;display:block!important;background:#fff!important;overflow:visible!important}
    .el-overlay-dialog{overflow:visible!important;display:block!important;height:auto!important}
    .el-dialog{margin:0 auto!important;max-height:none!important;height:auto!important;width:98%!important;box-shadow:none!important}
    .el-dialog__body{max-height:none!important;overflow:visible!important;padding:8px!important}
    .el-table{max-height:none!important;height:auto!important}
    .el-table .el-scrollbar__wrap,.el-table .el-table__body-wrapper{max-height:none!important;overflow:visible!important;height:auto!important}
    .el-table .el-scrollbar__bar{display:none!important}
  `
  document.head.appendChild(st)
})
await page.waitForTimeout(1200)

const pdf = await page.cdp('Page.printToPDF', {
  printBackground: true,
  paperWidth: 12, paperHeight: 34,
  marginTop: 0.2, marginBottom: 0.2, marginLeft: 0.2, marginRight: 0.2,
  preferCSSPageSize: false,
})
const b64 = pdf?.data || pdf?.result?.data
if (b64) {
  writeFileSync(`${EV}/trace-dialog-8091.pdf`, Buffer.from(b64, 'base64'))
  console.log(`PDF OK: ${EV}/trace-dialog-8091.pdf (${Math.round(Buffer.from(b64, 'base64').length / 1024)}KB)`)
} else console.log('PDF FAIL')

const fail = results.filter((x) => x.startsWith('[FAIL]')).length
console.log('\n' + results.join('\n'))
console.log(fail === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fail})`)
