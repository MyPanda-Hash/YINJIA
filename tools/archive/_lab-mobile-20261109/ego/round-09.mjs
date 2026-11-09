const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
const st = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.labm-field')].map((f) => {
    const label = f.querySelector('label')?.textContent?.trim() || ''
    const sel = f.querySelector('.el-select')
    const selText = sel ? (sel.textContent || '').replace(/\s+/g, ' ').trim() : ''
    return { label, select: selText, input: f.querySelector('input')?.value ?? null }
  })
  return rows
})
console.log(JSON.stringify(st, null, 2))
