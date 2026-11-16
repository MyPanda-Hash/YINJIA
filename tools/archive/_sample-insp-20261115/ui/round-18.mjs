/* round-18:打印态下谁把内容推到第 2 页(找 bottom > 1062 且未 display:none 的元素) */
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => s.name === 'sample-insp-20261115')
const task = entry.ownership === 'user' ? await claimTaskSpace(entry.id) : await taskSpace(entry.id)
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.evaluate(() => document.body.classList.add('approval-printing'))
await page.waitForTimeout(800)
const info = await page.evaluate(() => {
  const A4H = 1062
  const out = []
  const all = [...document.querySelectorAll('body *')]
  for (const el of all) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (r.height === 0) continue
    if (r.bottom > A4H) {
      out.push({
        tag: el.tagName, cls: String(el.className).slice(0, 60),
        top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
        pos: cs.position, page: cs.page,
      })
    }
  }
  return {
    innerW: window.innerWidth,
    bodyH: document.body.scrollHeight,
    docH: document.documentElement.scrollHeight,
    paper: (() => { const el = document.querySelector('.ic-sheet'); const r = el.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), bottom: Math.round(r.bottom) } })(),
    offenders: out.slice(0, 25),
    offCount: out.length,
  }
})
console.log(JSON.stringify(info, null, 1))
await page.evaluate(() => document.body.classList.remove('approval-printing'))
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
