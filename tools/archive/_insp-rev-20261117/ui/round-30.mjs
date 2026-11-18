// round-30: 诊断——纸面各行/各输入框归属(为什么打字没进 head)
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')

const dump = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  return rows.slice(0, 8).map((tr, i) => ({
    i,
    text: txt(tr).slice(0, 50),
    inputs: [...tr.querySelectorAll('input')].map((inp) => ({
      v: inp.value,
      ph: inp.placeholder,
      cls: String(inp.className).slice(0, 40),
      y: Math.round(inp.getBoundingClientRect().y),
      x: Math.round(inp.getBoundingClientRect().x),
    })),
  }))
})
console.log(JSON.stringify(dump, null, 2))

const dirty = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    tab: txt(document.querySelector('.el-tabs__item.is-active')),
    side: txt(document.querySelector('.approval-side')).slice(0, 60),
  }
})
console.log('ctx=' + JSON.stringify(dirty))
