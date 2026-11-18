const task = await taskSpace('material-ret-fix-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/', { timeout: 40000 })
await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const classes = new Set()
  ;[...document.querySelectorAll('body *')].forEach((el) => {
    if (el.className && typeof el.className === 'string') el.className.split(/\s+/).forEach((c) => { if (c) classes.add(c) })
  })
  return {
    hash: location.hash,
    bodyStart: txt(document.body).slice(0, 400),
    navish: [...document.querySelectorAll('aside, nav, .left-nav, [class*="nav"], [class*="menu"]')].slice(0, 6).map((el) => el.tagName + '.' + el.className),
    sampleClasses: [...classes].filter((c) => /nav|menu|tree|side/i.test(c)).slice(0, 40),
  }
})
console.log(JSON.stringify(info, null, 2))
