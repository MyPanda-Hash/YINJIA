const task = await taskSpace('deploy-20261118-verify')
const page = task.page('p1')
await page.goto('http://36.140.66.163:8090/', { timeout: 60000 })
await page.waitForTimeout(5000)
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find(i => (i.placeholder||'').includes('账号')); const p = ins.find(i => (i.placeholder||'').includes('密码'))
  if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
})
await page.waitForTimeout(600)
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('进入系统')); if(b) b.click() })
await page.waitForTimeout(7000)
await page.goto('http://36.140.66.163:8090/#/panelx/list/MIX_BOM', { timeout: 60000 })
await page.waitForTimeout(7000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
} catch (e) { console.log('restore skip: ' + e.message) }
const st = await page.evaluate(() => {
  const txt = document.body.innerText || ''
  return { hash: location.hash, has500: /500|Invalid object name|列名.*无效/.test(txt), hasTitle: txt.includes('混料物料清单'),
           cols: [...document.querySelectorAll('.el-table__header th')].map(t=>(t.textContent||'').trim()).filter(Boolean).slice(0,10) }
})
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/deploy-20261118/round-01-mixbom.png' })
await task.finish({ keep: 'all' })
