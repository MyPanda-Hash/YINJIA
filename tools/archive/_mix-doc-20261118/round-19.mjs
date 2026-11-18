/**
 * round-19:8090(最终发布产物)复核明细页:标题「混料单」、抬头「上次混料单」、无行内撤回按钮、提交置灰。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0015&line=1', { timeout: 30000 })
await page.waitForTimeout(3500)
const info = await page.evaluate(() => ({
  hash: location.hash,
  chunk: [...document.querySelectorAll('script[src]')].map((s) => s.src).filter((s) => /index-/.test(s)).slice(-1)[0] || '',
  title: (document.querySelector('.mp-title') || {}).innerText || '',
  kv: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  rows: [...document.querySelectorAll('.mp-line')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  undoGone: !document.querySelector('.mp-line-undo'),
  submitDisabled: (() => { const b = document.querySelector('.mp-foot button'); return b ? !!b.disabled : null })(),
  err: (document.querySelector('.mp-err') || {}).innerText || '',
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-19-8090-final.png' })
