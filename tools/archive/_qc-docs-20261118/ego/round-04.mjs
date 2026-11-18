const task = await taskSpace('qc-docs-20261118')
const page = task.page('p1')

async function wide() {
  try {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
    await page.waitForTimeout(300)
  } catch (e) {}
}

const code = process.env.PANEL || 'QC_INSP_REQ_SERIES'
await page.goto(`http://localhost:5173/#/panelx/list/${code}`, { timeout: 30000 })
await page.waitForTimeout(6000)
await wide()

// ① 新增一行,并在「检验方法1」格里填一段长文本(模拟真实的长内容)
const added = await page.evaluate(() => {
  const add = [...document.querySelectorAll('.rs-add')][0]
  if (!add) return false
  add.click()
  return true
})
await page.waitForTimeout(1200)
const filled = await page.evaluate(() => {
  const row = document.querySelector('.qc-paper tr[data-edit="1"]')
  if (!row) return 'no-edit-row'
  const areas = [...row.querySelectorAll('textarea')]
  if (!areas.length) return 'no-textarea'
  const long = '组件封装 10g 阻垢材料，纯水/超纯水流量 3L/min 冲洗 30min，装入 500ml 棕色瓶加 500ml 浸泡液避光密封恒温 25℃ 浸泡 14-16h，摇匀倒出上清液，重金属用针筒膜过滤后加酸测试。'
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  // 第 5 个值列 = 检验方法1(前 4 列是物料编号/文件编码/检验依据/…),退而给前两个文本域都填上
  setVal(areas[Math.min(3, areas.length - 1)], long)
  if (areas.length > 4) setVal(areas[4], 'tds增加值≤30mg/L；ph改变值≤0.7；cod增加值≤5mg/L；总磷增加值≤0.005mg/L')
  return 'ok:' + areas.length
})
await page.waitForTimeout(600)
// ② 完成编辑 → 只读态行高
await page.evaluate(() => {
  const b = document.querySelector('.qc-paper .rs-op-done')
  if (b) b.click()
})
await page.waitForTimeout(1200)
const readMode = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qc-paper tbody tr')].filter((r) => r.querySelector('.rs-td'))
  const r0 = rows[rows.length - 1]
  return { h: r0 ? Math.round(r0.getBoundingClientRect().height) : 0, text: (r0?.textContent || '').replace(/\s+/g, ' ').slice(0, 80) }
})
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r04-read.png' })

// ③ 再点「修改」 → 编辑态行高(必须与只读态同量级,不能塌成单行)
const clicked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qc-paper tbody tr')].filter((r) => r.querySelector('.rs-td'))
  const r0 = rows[rows.length - 1]
  const b = r0 && r0.querySelector('.rs-op-edit')
  if (!b) return false
  b.click()
  return true
})
await page.waitForTimeout(1200)
const editMode = await page.evaluate(() => {
  const row = document.querySelector('.qc-paper tr[data-edit="1"]')
  const areas = row ? [...row.querySelectorAll('textarea')] : []
  return {
    h: row ? Math.round(row.getBoundingClientRect().height) : 0,
    areas: areas.length,
    areaHeights: areas.map((a) => Math.round(a.getBoundingClientRect().height)),
    inputTags: row ? [...row.querySelectorAll('.rs-c-in')].map((e) => e.tagName) : [],
  }
})
console.log('added:', added, 'filled:', filled)
console.log('readMode:', JSON.stringify(readMode))
console.log('clicked edit again:', clicked)
console.log('editMode:', JSON.stringify(editMode))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r04-edit.png' })
console.log('done')
