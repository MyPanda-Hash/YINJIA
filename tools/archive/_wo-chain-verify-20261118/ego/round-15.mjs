// round-15: 8090(正式库)复核:装箱2(新厂) 的 GD-2026-11-0012 行3 计划完工已到 11-23;1号车间(成型)仍 11-13
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function boardLine(name) {
  await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 60000 })
  await page.reload({ timeout: 60000 })
  await sleep(6500)
  const logged = await page.evaluate(() => !!document.querySelector('.wb-page'))
  if (!logged) {
    await page.evaluate(() => { localStorage.clear() })
    await page.goto('http://127.0.0.1:8090/#/login', { timeout: 60000 })
    await page.reload({ timeout: 60000 })
    await sleep(2500)
    await page.fill('input[placeholder="请输入登录账号"]', 'admin')
    await page.fill('input[placeholder="请输入登录密码"]', '123456')
    await page.click('text="进入系统"')
    await sleep(4500)
    await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 60000 })
    await page.reload({ timeout: 60000 })
    await sleep(6500)
  }
  await page.evaluate((n) => {
    const line = [...document.querySelectorAll('.wb-line')].find((el) => (el.textContent || '').includes(n))
    if (line) line.click()
  }, name)
  await sleep(5000)
  return page.evaluate(() => {
    const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
    const tr = [...document.querySelectorAll('.el-table__body tr')].find((x) => (x.textContent || '').includes('GD-2026-11-0012'))
    if (!tr) return { line: (document.querySelector('.wb-ctx-label') || {}).textContent, found: false }
    const cells = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
    const at = (p) => cells[heads.findIndex((t) => t.startsWith(p))]
    return { line: (document.querySelector('.wb-ctx-label') || {}).textContent, found: true, 开工: at('开工日期'), 计划完工: at('计划完工日期') }
  })
}
const box = await boardLine('装箱2(新厂)')
console.log('装箱2(新厂)=' + JSON.stringify(box))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await sleep(600)
  await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-15-prod-boxline.png' })
} catch (e) { console.log('shot skip: ' + e.message) }
const mold = await boardLine('1号车间')
console.log('1号车间=' + JSON.stringify(mold))
