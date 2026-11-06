// round-12：确认 8090 当前活体是「可编辑纸面 + 三格无前缀 + 有 input」
const task = await taskSpace('yj-rod-spec')
const page = task.page('p2')
await page.goto('http://127.0.0.1:8090/#/panelx/list/RD_MOLD_PROC', { timeout: 30000 })
await page.waitForTimeout(5000)
const r = await page.evaluate(() => {
  const td = [...document.querySelectorAll('td')].filter((c) => c.querySelector('input'))
  // 找「炭棒规格」标签行下面的那三个值格
  const label = [...document.querySelectorAll('td')].find((c) => (c.innerText || '').trim() === '炭棒规格')
  let cells = []
  if (label) {
    const tr = label.closest('tr')
    const idx = [...tr.children].indexOf(label)
    const next = tr.nextElementSibling
    if (next) cells = [...next.children].slice(idx, idx + 3).map((c) => c.innerHTML.replace(/\s+/g, ' ').slice(0, 160))
  }
  return {
    paperInputs: document.querySelectorAll('table.rs-t input').length,
    rsPreSpans: document.querySelectorAll('.rs-pre').length,
    hasWaiIn: (document.body.innerText || '').includes('外：'),
    specCellsHtml: cells,
    entry: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')).filter((s) => s.includes('index-'))[0],
  }
})
console.log(JSON.stringify(r, null, 1))
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-rodspec-20261106/C-live-8090.png' })
