const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
const probe = await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')].filter((el) => {
    const t = (el.textContent || '').replace(/\s+/g, '')
    return t === '保存' && el.children.length <= 2
  })
  return all.slice(0, 6).map((el) => ({
    tag: el.tagName, cls: el.className, id: el.id,
    rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })(),
    parent: el.parentElement ? { tag: el.parentElement.tagName, cls: el.parentElement.className } : null,
  }))
})
console.log(JSON.stringify(probe, null, 2))
