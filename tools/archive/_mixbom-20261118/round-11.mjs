const base = 'http://127.0.0.1:8090'
const login = await fetch(base + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const token = login.data.token, user = login.data.user
console.log('LOGIN', login.code, user.factory)
const task = await taskSpace('mixbom-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MIX_BOM', { timeout: 30000 })
await page.waitForTimeout(1500)
await page.evaluate(({ token, user }) => {
  localStorage.setItem('mes_token', token)
  localStorage.setItem('mes_user', JSON.stringify(user))
  localStorage.setItem('mes_init_done', '1')
}, { token, user })
for (const url of [
  'http://localhost:5173/#/panelx/list/MIX_BOM?docNo=MIX-2026-11-0001',
  'http://localhost:5173/#/panelx/list/ASM_BOM?docNo=C-23-11_V0001',
]) {
  await page.goto(url, { timeout: 30000 })
  await page.waitForTimeout(3200)
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
  const info = await page.evaluate(() => ({
    doc: document.body.innerText.match(/单据：\s*\S+/)?.[0] || '',
    factory: JSON.parse(localStorage.getItem('mes_user') || '{}').factory,
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 900),
  }))
  console.log(JSON.stringify(info, null, 1))
  const tag = url.includes('MIX_BOM') ? 'prod-mix' : 'prod-asm'
  await page.screenshot({ path: `C:/Users/vigna/ego/mixbom-20261118/11-${tag}.png` })
}
