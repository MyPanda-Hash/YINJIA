/**
 * 第 03 轮:连扫第二条验证「手选仓库会粘住」+ 列全下拉选项(停用仓必须不在) + 提交到测试库。
 * 承接 round-02(清单里已有 1 行:YJ-CH-016 → 原料不良品仓)。
 */
const task = await taskSpace('other-ret-wh-20261119')
const page = task.page('p1')

// 1) 再扫同一条料:手选过的仓应当粘住(原料不良品仓),不被库存行(华北工控仓)刷回
await page.fill('.mo-scanbar input', 'YJ-CH-016')
await page.press('.mo-scanbar input', 'Enter')
await page.waitForTimeout(4000)
const sticky = await page.evaluate(() => {
  const sel = document.querySelector('.mo-wh .el-select')
  return sel ? (sel.textContent || '').replace(/\s+/g, ' ').trim() : null
})
console.log('第二次扫码后的退到仓库:', sticky)

// 2) 点开下拉,把选项全列出来(停用仓一个都不该出现)
await page.evaluate(() => {
  const sel = document.querySelector('.mo-wh .el-select')
  if (sel) sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
})
await page.waitForTimeout(1000)
const allOpts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
  .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('下拉全部选项:', JSON.stringify(allOpts))
const banned = ['原料仓', '辅料仓', '成品仓', '半成品仓', '不良品仓', '辅料及配件区A仓']
console.log('混进下拉的停用仓:', JSON.stringify(allOpts.filter((t) => banned.includes(t))))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/other-ret-wh-20261119/round-03-dropdown.png' })
console.log('截图: round-03-dropdown.png')

// 3) 收起下拉,把这一行也加入清单
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.mo-qty button')].find((b) => (b.textContent || '').includes('加入清单'))
  if (btn) btn.click()
})
await page.waitForTimeout(1200)
console.log('清单行:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.mo-line')]
  .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()))))

// 4) 提交(= 在测试库生成一张生产退料单;提交后按约定清理)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.mo-foot button')].find((b) => (b.textContent || '').includes('提交'))
  if (btn) btn.click()
})
await page.waitForTimeout(9000)
const done = await page.evaluate(() => {
  const al = [...document.querySelectorAll('.el-alert')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
  return { alerts: al, hash: location.hash }
})
console.log('提交结果:', JSON.stringify(done, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/other-ret-wh-20261119/round-03-submitted.png' })
console.log('截图: round-03-submitted.png')
