/**
 * 第 02 轮:核对「退到仓库」下拉 —— 默认值、停用仓是否被排掉、改仓后加入清单是否用新仓。
 * 承接 round-01(已在测试库登录并扫过 YJ-CH-016,页面停在其他退料扫码页)。
 */
const task = await taskSpace('other-ret-wh-20261119')
const page = task.page('p1')

// 0) 先确认这次登的是哪个账套(准备提交测试单,必须落在测试库)
const env = await page.evaluate(() => {
  const out = {}
  for (const k of Object.keys(localStorage)) {
    if (/factory|db|login|user/i.test(k)) out[k] = String(localStorage.getItem(k) || '').slice(0, 160)
  }
  return out
})
console.log('localStorage(登录相关):', JSON.stringify(env, null, 2))

// 1) 默认仓库 + 加入清单按钮态
const before = await page.evaluate(() => {
  const sel = document.querySelector('.mo-wh .el-select')
  const btn = [...document.querySelectorAll('.mo-qty button')].find((b) => (b.textContent || '').includes('加入清单'))
  return {
    selected: sel ? (sel.querySelector('.el-select__selected-item') || {}).textContent : null,
    selectedText: sel ? (sel.textContent || '').replace(/\s+/g, ' ').trim() : null,
    addDisabled: btn ? btn.disabled : null,
  }
})
console.log('改仓前:', JSON.stringify(before, null, 2))

// 2) 点开下拉,看选项里有没有停用仓
await page.evaluate(() => {
  const sel = document.querySelector('.mo-wh .el-select')
  if (sel) sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
})
await page.waitForTimeout(900)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown')]
  .filter((d) => d.offsetParent !== null)
  .flatMap((d) => [...d.querySelectorAll('.el-select-dropdown__item')]
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())))
console.log('退到仓库选项:', JSON.stringify(opts))

// 3) 改成「原料不良品仓」
await page.evaluate(() => {
  const opt = [...document.querySelectorAll('.el-select-dropdown__item')]
    .find((el) => (el.textContent || '').includes('原料不良品仓'))
  if (opt) opt.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(800)
const afterPick = await page.evaluate(() => {
  const sel = document.querySelector('.mo-wh .el-select')
  const btn = [...document.querySelectorAll('.mo-qty button')].find((b) => (b.textContent || '').includes('加入清单'))
  return {
    selected: sel ? (sel.querySelector('.el-select__selected-item') || {}).textContent : null,
    addDisabled: btn ? btn.disabled : null,
  }
})
console.log('改仓后:', JSON.stringify(afterPick, null, 2))

// 4) 加入清单 —— 清单行必须显示选中的仓
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.mo-qty button')].find((b) => (b.textContent || '').includes('加入清单'))
  if (btn) btn.click()
})
await page.waitForTimeout(1500)
const lines = await page.evaluate(() => [...document.querySelectorAll('.mo-line')]
  .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('清单行:', JSON.stringify(lines, null, 2))
console.log('提交按钮可点:', await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.mo-foot button')].find((b) => (b.textContent || '').includes('提交'))
  return btn ? !btn.disabled : null
}))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/other-ret-wh-20261119/round-02-pick-wh.png' })
console.log('截图: round-02-pick-wh.png')
