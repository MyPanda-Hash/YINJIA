// 第 4 轮:新增单 → 加 3 个检验项 → 填内容(项目/方法/要求/录入结果)
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')

const state = async (tag) => {
  const s = await page.evaluate(() => {
    const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
    return {
      bandActs: [...document.querySelectorAll('.qr-band-act')].map(txt),
      number: (document.querySelector('.qr-head-table .qr-value input') || {}).value || txt(document.querySelectorAll('.qr-head-table .qr-value')[0]),
      batchNames: [...document.querySelectorAll('.c-batchname input')].map((i) => i.value),
      textareas: document.querySelectorAll('.qr-grid textarea').length,
      rows: [...document.querySelectorAll('.qr-grid tbody tr')].map((tr) => [...tr.children].map((td) => txt(td))),
    }
  })
  console.log('== ' + tag + ' ==\n' + JSON.stringify(s, null, 2))
  return s
}

const clickBand = async (label) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('.qr-band-act')].find((e) => (e.textContent || '').includes(t))
    if (!el) return false
    el.click()
    return true
  }, label)
  await page.waitForTimeout(800)
  return ok
}

await state('开始')
console.log('addItem x3: ' + (await clickBand('新增检验项')) + (await clickBand('新增检验项')) + (await clickBand('新增检验项')))
await page.waitForTimeout(1000)
await state('加 3 项后')

// 批次号改成截图里的 20281117(表头输入框,change/blur 提交)
const renamed = await page.evaluate(() => {
  const inp = document.querySelector('.qr-batch-input input')
  if (!inp) return 'no-input'
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '20281117')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
  return 'ok'
})
console.log('rename batch: ' + renamed)
await page.waitForTimeout(1200)
await state('改名后')

// 填 3 行
const filled = await page.evaluate(() => {
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const s = Object.getOwnPropertyDescriptor(proto, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const data = [
    { item: '*外观', mtd: '目视', req: '表面清洁、无破损、无压痕、无裂纹、无倾斜、无油胶等缺陷', txt: 'OK' },
    { item: '*整体尺寸（内PP棉、外包布、套网、打端盖）', mtd: '游标卡尺', req: '外径：40±0.5mm\n长度：236±1mm', txt: '40.5/40.2/40.3/40.1/40' },
    { item: '*出货重量', mtd: '电子秤', req: '>148g', txt: '148/150/149/151/152' },
  ]
  const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
  return rows.slice(0, 3).map((tr, i) => {
    const tas = [...tr.querySelectorAll('textarea')]
    const d = data[i]
    if (d) {
      setVal(tas[0], d.item); setVal(tas[1], d.mtd); setVal(tas[2], d.req)
      if (tas[3]) setVal(tas[3], d.txt)
    }
    return { i, tas: tas.length }
  })
})
console.log('filled: ' + JSON.stringify(filled))
await page.waitForTimeout(1200)
await state('填完')

const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(400)
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-04.png' })
