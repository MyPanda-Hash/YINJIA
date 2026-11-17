// round-13: 另一个来料检验要求(QC_INSP_REQ,7 张固定表)——「PP管」满 20/20 时,别的表照常能加
// 测试库;先在 PP管 看满额提示+禁用,再切回 折叠棉 加一组(父目录+两个子目录)证明不串表。
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
const BASE = 'http://localhost:5173'

async function ensureTestLedger() {
  await page.waitForTimeout(4000)
  const need = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('登录账号')))
  if (!need) return
  const fac = await page.evaluate(() => [...document.querySelectorAll('.el-form-item')]
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).find((t) => t.includes('登录工厂')))
  if (!fac || !fac.includes('测试库')) {
    await page.evaluate(() => {
      const it = [...document.querySelectorAll('.el-form-item')].find((el) => (el.textContent || '').includes('登录工厂'))
      ;(it?.querySelector('.el-select__wrapper') || it?.querySelector('.el-select'))?.click()
    })
    await page.waitForTimeout(700)
    await page.evaluate(() => {
      const o = [...document.querySelectorAll('.el-select-dropdown__item')].find((el) => (el.textContent || '').includes('测试库'))
      if (o) o.click()
    })
    await page.waitForTimeout(500)
  }
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456')
  })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))?.click())
  await page.waitForTimeout(6000)
}

await page.goto(`${BASE}/#/panelx/list/QC_INSP_REQ`, { timeout: 30000 })
await ensureTestLedger()
await page.goto(`${BASE}/#/panelx/list/QC_INSP_REQ`, { timeout: 30000 })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(9000)
console.log('账套 =', await page.evaluate(() => (document.querySelector('.factory .factory-name')?.textContent || '').trim()))
console.log('面板 sheet =', await page.evaluate(() => !!document.querySelector('.qc-insp-sheet')))

async function openDialog() {
  await page.evaluate(() => {
    const n = [...document.querySelectorAll('.qc-insp-sheet *')]
      .find((e) => e.children.length <= 1 && (e.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[^\w\u4e00-\u9fa5]+/, '') === '自定义字段')
    if (n) n.click()
  })
  await page.waitForTimeout(3500)
}
async function state() {
  return page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
    if (!d) return { noDialog: true }
    const btn = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
    return {
      summary: (d.querySelector('.fm-summary')?.textContent || '').replace(/\s+/g, ' ').trim(),
      chips: [...d.querySelectorAll('.fm-tabusage-item')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
      alerts: [...d.querySelectorAll('.el-alert__title')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
      tab: (d.querySelector('.el-select .el-select__selected-item, .el-select__placeholder, .el-select')?.textContent || '').replace(/\s+/g, ' ').trim(),
      addDisabled: btn ? btn.disabled : null,
      rows: [...d.querySelectorAll('.el-table__body tbody tr')].length,
    }
  })
}
async function pickTab(name) {
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
    const it = [...d.querySelectorAll('.el-form-item')].find((x) => (x.textContent || '').includes('所属页签'))
    ;(it?.querySelector('.el-select__wrapper') || it?.querySelector('.el-select'))?.click()
  })
  await page.waitForTimeout(700)
  const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
    .filter((el) => el.offsetParent !== null).map((el) => (el.textContent || '').trim()))
  console.log('  页签候选 =', JSON.stringify(opts))
  const clicked = await page.evaluate((t) => {
    const o = [...document.querySelectorAll('.el-select-dropdown__item')].filter((el) => el.offsetParent !== null)
      .find((el) => (el.textContent || '').trim() === t)
    if (o) { o.click(); return true }
    return false
  }, name)
  await page.waitForTimeout(1200)
  return clicked
}

await openDialog()
console.log('初始(折叠棉)=', JSON.stringify(await state(), null, 2))

// 切到满额的 PP管
console.log('切到 PP管 =', await pickTab('PP管'))
const full = await state()
console.log('PP管 状态 =', JSON.stringify(full, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-13-qcreq-full-tab.png' })

// 切回另一张表:提示应消失、能加
console.log('切回 折叠棉 =', await pickTab('折叠棉'))
const tag = String(Date.now()).slice(-4)
await page.evaluate((p) => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  const it = [...d.querySelectorAll('.el-form-item')].find((x) => (x.textContent || '').includes('父目录'))
  const inp = it?.querySelector('input')
  if (!inp) return
  inp.click()
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, p); inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
  inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
}, '验证父' + tag)
await page.waitForTimeout(700)
await page.evaluate(({ a, b }) => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const items = [...d.querySelectorAll('.el-form-item')]
  const i1 = items.find((it) => (it.textContent || '').includes('子目录1'))?.querySelector('input')
  const i2 = items.find((it) => (it.textContent || '').includes('子目录2'))?.querySelector('input')
  if (i1) setVal(i1, a)
  if (i2) setVal(i2, b)
}, { a: '验证法' + tag, b: '验证标' + tag })
await page.waitForTimeout(700)
const beforeAdd = await state()
console.log('折叠棉 填完 =', JSON.stringify(beforeAdd, null, 2))
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  const btn = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
  if (btn && !btn.disabled) btn.click()
})
await page.waitForTimeout(4500)
const after = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  return {
    messages: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
    summary: (d?.querySelector('.fm-summary')?.textContent || '').replace(/\s+/g, ' ').trim(),
    chipPpGuan: [...(d?.querySelectorAll('.fm-tabusage-item') || [])].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t.startsWith('PP管') || t.startsWith('折叠棉')),
    alerts: [...(d?.querySelectorAll('.el-alert__title') || [])].map((e) => e.textContent.trim()),
  }
})
console.log('折叠棉 加列后 =', JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-13-qcreq-other-tab-add.png' })
console.log('names =', JSON.stringify({ tag }))
console.log('done round-13')
