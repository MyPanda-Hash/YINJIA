// round-16: 必填红 * 渲染 + 未填就保存的拦截提示
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1000 } })
  }
  await T(400)
} catch (e) { console.log('resize skip: ' + e.message) }

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(6000)

const already = await page.evaluate(() => document.querySelector('.topbar')?.textContent?.includes('测试库'))
console.log('test-db=' + already)

const added = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '新增')
  if (!btn) return 'no-btn'
  btn.click()
  return 'clicked'
})
console.log('add=' + added)
await T(7000)

const stars = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    reqLabels: [...sheet.querySelectorAll('.ic-req')].map((s) => txt(s.parentElement)),
    reqColor: (() => {
      const s = sheet.querySelector('.ic-req')
      return s ? getComputedStyle(s).color : ''
    })(),
    docNo: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value),
  }
})
console.log('stars=' + JSON.stringify(stars))
await page.screenshot({ path: dir + '/shots/round-16-required.png' })

// 什么都不填直接保存 → 应被必填校验拦下
const save = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '保存')
  if (!btn) return 'no-save'
  btn.click()
  return 'clicked'
})
console.log('save=' + save)
await T(6000)

const blocked = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const box = document.querySelector('.el-message-box')
  return {
    box: box ? txt(box).slice(0, 400) : '',
    msg: [...document.querySelectorAll('.el-message')].map((m) => txt(m)).join(' | ').slice(0, 300),
    editable: document.querySelector('[data-ic-sheet]')?.className.includes('is-editing'),
  }
})
console.log(JSON.stringify(blocked, null, 2))
await page.screenshot({ path: dir + '/shots/round-16-blocked.png' })
