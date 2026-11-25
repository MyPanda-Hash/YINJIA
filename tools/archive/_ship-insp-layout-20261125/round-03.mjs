// 第 3 轮:在测试库里开一张新单,加 3 个检验项,并把 3 行内容填成用户截图里的样子
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
const dump = async (tag) => {
  const s = await page.evaluate(() => {
    const sheet = document.querySelector('.qr-sheet')
    const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
    return {
      sheet: !!sheet,
      head: sheet ? [...sheet.querySelectorAll('.qr-head-table .qr-value')].map(txt) : [],
      batchHead: [...document.querySelectorAll('.c-batchname')].map((th) => th.innerHTML.replace(/\s+/g, ' ').slice(0, 400)),
      textareas: document.querySelectorAll('.qr-grid textarea').length,
      inputs: [...document.querySelectorAll('.qr-grid input')].map((i) => i.value),
      rows: [...document.querySelectorAll('.qr-grid tbody tr')].map((tr) => [...tr.children].map((td) => txt(td))),
      selects: [...document.querySelectorAll('.qr-grid .el-select')].length,
    }
  })
  console.log('== ' + tag + ' ==\n' + JSON.stringify(s, null, 2))
  return s
}

// 找「新增」按钮并点击(右侧竖栏 .approval-side 里的文字按钮)
const clickText = async (label) => {
  const ok = await page.evaluate((t) => {
    const cands = [...document.querySelectorAll('span, button, a, div')]
      .filter((el) => (el.textContent || '').trim() === t && el.children.length === 0)
    for (const el of cands) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) { el.click(); return true }
    }
    return false
  }, label)
  console.log('click ' + label + ' -> ' + ok)
  await page.waitForTimeout(1500)
  return ok
}

await dump('打开时')
await clickText('新增')
await page.waitForTimeout(2000)
const afterNew = await dump('新增后')

// 三个检验项
for (let i = 0; i < 3; i++) {
  await clickText('新增检验项')
}
await page.waitForTimeout(1200)
await dump('加 3 项后')

// 填内容:项目/方法/要求/录入结果
const filled = await page.evaluate(() => {
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const s = Object.getOwnPropertyDescriptor(proto, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
  const data = [
    { item: '*外观', mtd: '目视', req: '表面清洁、无破损、无压痕、无裂纹、无倾斜、无油胶等缺陷', txt: 'OK' },
    { item: '*整体尺寸（内PP棉、外包布、套网、打端盖）', mtd: '游标卡尺', req: '外径：40±0.5mm\n长度：236±1mm', txt: '40.5/40.2/40.3/40.1/40' },
    { item: '*出货重量', mtd: '电子秤', req: '>148g', txt: '148/150/149/151/152' },
  ]
  const out = []
  rows.slice(0, 3).forEach((tr, i) => {
    const tas = [...tr.querySelectorAll('textarea')]
    const d = data[i]
    setVal(tas[0], d.item)
    setVal(tas[1], d.mtd)
    setVal(tas[2], d.req)
    if (tas[3]) setVal(tas[3], d.txt)
    out.push({ i, taCount: tas.length })
  })
  return out
})
console.log('filled ' + JSON.stringify(filled))
await page.waitForTimeout(1200)
await dump('填完(未保存)')

const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.cdp('Browser.setWindowBounds', {})
await page.waitForTimeout(400)
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-03.png' })
