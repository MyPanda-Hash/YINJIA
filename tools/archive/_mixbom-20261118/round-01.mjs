const task = await taskSpace('asm-bom-check-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/ASM_BOM', { timeout: 30000 })
await page.waitForTimeout(3000)
const state = await page.evaluate(() => ({ hash: location.hash, login: !!document.querySelector('input[placeholder*="账号"]'), body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 260) }))
console.log('STATE', JSON.stringify(state))
if (state.login) {
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  await page.goto('http://127.0.0.1:8090/#/panelx/list/ASM_BOM', { timeout: 30000 })
  await page.waitForTimeout(2500)
}
try { const w = await page.cdp('Browser.getWindowForTarget', {}); if (w?.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } }); await page.waitForTimeout(400) } catch (e) {}
const info = await page.evaluate(() => ({
  doc: document.body.innerText.match(/单据：\s*\S+/)?.[0] || '',
  nav: document.body.innerText.match(/第\s*\d+\/\d+\s*张/)?.[0] || '',
  rows: [...document.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim()).join(' | ')).filter((s) => s.replace(/\|/g, '').trim()).slice(0, 10),
  body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 700),
}))
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/asm-bom-check-20261118/01-prod-asm.png' })
