// round-07:复现并验证「生产退料扫组装/混料二维码都跳混料明细」的修复
// 复现路径:先进过一张单(混料 LL-2026-11-0052 = 台账 id 861),再返回列表点另一张(组装 id 860)。
// 修复前:因为 PortalLayout 用 route.path 做 keep-alive key,query 变了但组件被复用,
//        docId 是 ref 只取第一次 ⇒ 页面仍停在 861(混料)。
const task = await taskSpace('other-pick-print-20261118')
const p1 = task.page('p1')

async function shot(p, path) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { console.log('restore skip: ' + e.message) }
  await p.waitForTimeout(400)
  await p.screenshot({ path })
}

const readDoc = () => {
  const t = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    title: t(document.querySelector('.mp-title') || document.body),
    kv: [...document.querySelectorAll('.mp-kv')].slice(0, 6).map(t),
    state: t(document.querySelector('.mp-state') || document.body),
  }
}

// ① 先进「混料」那张(它还没有可退量,页面会提示不能退,但抬头能看出是哪张单)
await p1.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN/doc?id=861', { timeout: 60000 })
await p1.waitForTimeout(4500)
console.log('--- 第一张(混料, id=861)')
console.log(JSON.stringify(await p1.evaluate(readDoc), null, 2))
await shot(p1, 'C:/Users/Lenovo/ego/other-pick-print-20261118/return-doc-861.png')

// ② 返回列表
await p1.evaluate(() => { const b = document.querySelector('.mp-back'); if (b) b.click() })
await p1.waitForTimeout(2500)
console.log('--- 回到列表: ' + (await p1.url()))

// ③ 点列表第一行(组装 LL-2026-11-0051 = 台账 id 860)
const clicked = await p1.evaluate(() => {
  const row = document.querySelector('.mr-doc')
  if (!row) return 'no-row: ' + (document.querySelector('.mr-empty')?.innerText || document.body.innerText.slice(0, 200))
  const no = (row.querySelector('.mr-doc-no') || {}).innerText || ''
  row.click()
  return (no || '').trim()
})
console.log('--- 点开的行: ' + clicked)
await p1.waitForTimeout(4500)
console.log('--- 点进去之后(应是组装 LL-2026-11-0051)')
console.log(JSON.stringify(await p1.evaluate(readDoc), null, 2))
await shot(p1, 'C:/Users/Lenovo/ego/other-pick-print-20261118/return-doc-after-switch.png')
console.log('done')
