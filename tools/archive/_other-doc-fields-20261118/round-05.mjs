// round-05:其他领料/其他退料「单据明细页」改版验证(抬头 + 每行明细),并与生产领料同页对比
const task = await taskSpace('other-pick-print-20261118')
const p1 = task.page('p1')

const readOther = () => {
  const t = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    title: t(document.querySelector('.mod-title') || document.body),
    state: t(document.querySelector('.mod-state') || document.body),
    kv: [...document.querySelectorAll('.mod-kv')].map(t),
    lines: [...document.querySelectorAll('.mod-line')].map(t),
    empty: [...document.querySelectorAll('.mod-empty')].map(t),
  }
}
const readPick = () => {
  const t = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    kv: [...document.querySelectorAll('.mp-kv')].map(t),
    lines: [...document.querySelectorAll('.mp-line')].map(t),
  }
}

async function shot(p, path) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { console.log('restore skip: ' + e.message) }
  await p.waitForTimeout(400)
  await p.screenshot({ path })
}

// ① 其他领料单明细(5173)
await p1.goto('http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK/doc?no=OO-2026-11-0011', { timeout: 60000 })
await p1.waitForTimeout(4500)
console.log('--- 5173 其他领料单')
console.log(JSON.stringify(await p1.evaluate(readOther), null, 2))
await shot(p1, 'C:/Users/Lenovo/ego/other-pick-print-20261118/other-pick-doc.png')

// ② 其他退料单明细(5173)
await p1.goto('http://localhost:5173/#/panelx/list/MOBILE_OTHER_RET/doc?no=TL-2026-11-0012', { timeout: 60000 })
await p1.waitForTimeout(4000)
console.log('--- 5173 其他退料单')
console.log(JSON.stringify(await p1.evaluate(readOther), null, 2))
await shot(p1, 'C:/Users/Lenovo/ego/other-pick-print-20261118/other-ret-doc.png')

// ③ 参照:生产领料单明细(5173)
await p1.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK/doc?no=LL-2026-11-0051', { timeout: 60000 })
await p1.waitForTimeout(4500)
console.log('--- 5173 生产领料单(参照)')
console.log(JSON.stringify(await p1.evaluate(readPick), null, 2))
await shot(p1, 'C:/Users/Lenovo/ego/other-pick-print-20261118/pick-doc-reference.png')
console.log('done')
