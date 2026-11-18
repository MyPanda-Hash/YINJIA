// round-32: 读 input 实际值(文本提取看不到 input.value)+ 关掉残留提示 + 干净截图
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

// 关掉挂着的 alert:先点 X,再兜底点按钮
for (let i = 0; i < 3; i++) {
  const closed = await page.evaluate(() => {
    const box = document.querySelector('.el-message-box')
    if (!box) return 'none'
    const x = box.querySelector('.el-message-box__headerbtn')
    if (x) { x.click(); return 'x' }
    const btn = [...box.querySelectorAll('button')].pop()
    if (btn) { btn.click(); return 'btn' }
    return 'stuck'
  })
  if (closed === 'none') break
  await T(700)
}

const vals = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const pick = (k) => rows.find((r) => (r.textContent || '').includes(k))
  const inputsOf = (k) => [...(pick(k)?.querySelectorAll('input') || [])].map((i) => i.value)
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    docNo: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value),
    contact: txt(pick('联系人')?.querySelector('.ic-text') || pick('联系人')),
    sampleRowInputs: inputsOf('样品名称'),
    kindBoxes: [...(pick('样品型号/规格')?.querySelectorAll('.ic-box') || [])].map((b) => txt(b)).join(''),
    kindText: txt(pick('样品型号/规格')?.querySelector('.ic-text')),
    msgBox: !!document.querySelector('.el-message-box'),
  }
})
console.log(JSON.stringify(vals, null, 2))
await page.screenshot({ path: dir + '/shots/round-32-saved-clean.png' })
