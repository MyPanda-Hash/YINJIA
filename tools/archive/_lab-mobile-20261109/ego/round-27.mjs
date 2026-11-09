const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
const out = await page.evaluate(() => {
  const side = document.querySelector('.approval-side')
  if (!side) return { err: 'no side', classes: [...new Set([...document.querySelectorAll('[class*=side]')].map((e) => e.className))].slice(0, 30) }
  const leaves = [...side.querySelectorAll('*')].filter((e) => !e.children.length && (e.textContent || '').trim())
  return {
    sideCls: side.className,
    leaves: leaves.map((e) => ({ tag: e.tagName, cls: e.className, txt: (e.textContent || '').trim(), pcls: e.parentElement?.className })).slice(0, 30),
  }
})
console.log(JSON.stringify(out, null, 2))
