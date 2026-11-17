/* round-15:打印态下行盒模型取证(判断重叠是真排版问题还是栅格化 artifact) */
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => s.name === 'sample-insp-20261115')
const task = entry.ownership === 'user' ? await claimTaskSpace(entry.id) : await taskSpace(entry.id)
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 733, height: 1062, deviceScaleFactor: 1, mobile: false })
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.evaluate(() => document.body.classList.add('approval-printing'))
await page.waitForTimeout(1000)
const info = await page.evaluate(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  const rows = [...document.querySelectorAll('.ic-grid tr')]
  const out = []
  for (const tr of rows) {
    const th = tr.querySelector('th')
    const name = (th?.innerText || '').replace(/\s+/g, ' ').slice(0, 20)
    if (!/判定规则|报告类型|样品处理方式|检验项目及要求/.test(name)) continue
    out.push({
      name,
      rowH: Math.round(tr.getBoundingClientRect().height),
      th: th ? rect(th) : null,
      thLH: th ? getComputedStyle(th).lineHeight : '',
      tdH: tr.querySelector('td') ? rect(tr.querySelector('td')) : null,
      tdLH: tr.querySelector('td') ? getComputedStyle(tr.querySelector('td')).lineHeight : '',
      opts: [...tr.querySelectorAll('.ic-opt')].map((o) => ({
        rect: rect(o),
        lh: getComputedStyle(o).lineHeight,
        disp: getComputedStyle(o).display,
        texts: [...o.querySelectorAll('span')].map((s) => ({ t: s.textContent.trim().slice(0, 18), rect: rect(s), lh: getComputedStyle(s).lineHeight, fs: getComputedStyle(s).fontSize })),
      })),
    })
  }
  return { width: window.innerWidth, rows: out }
})
console.log(JSON.stringify(info, null, 1).slice(0, 6000))
await page.evaluate(() => document.body.classList.remove('approval-printing'))
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
try { await page.cdp('Emulation.clearDeviceMetricsOverride', {}) } catch {}
