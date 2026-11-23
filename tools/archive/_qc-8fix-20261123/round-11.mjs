// round-11: 5 个项目 → 添加批次 → 两批分别填值 → 保存, 之后查库看落点
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p2')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(7000)
// 选中 ZC-2026-11-0010
const sel = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('ZC-2026-11-0010'))
  if (!tr) return 'not found'
  tr.click()
  return 'ok'
})
console.log('select doc:', sel)
await page.waitForTimeout(3000)
const band = () => page.evaluate(() => (document.querySelector('.qr-band')?.innerText || '').replace(/\s+/g, ' ').trim())
console.log('band:', await band())
const act = async (text) => {
  const ok = await page.evaluate((text) => {
    const el = [...document.querySelectorAll('.qr-band-act')].find((x) => (x.innerText || '').includes(text))
    if (el) { el.click(); return true }
    return false
  }, text)
  console.log('act', text, ok)
  await page.waitForTimeout(1000)
}
for (let i = 0; i < 5; i++) await act('新增检验项')
await act('添加批次')

// 填项目名/方法/要求 + 两个批次的实测值
const filled = await page.evaluate(() => {
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const s = Object.getOwnPropertyDescriptor(proto, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const t = document.querySelector('.qr-grid')
  const rows = [...t.querySelectorAll('tbody tr')]
  const res = []
  rows.forEach((tr, ri) => {
    const tas = [...tr.querySelectorAll('textarea')]
    // tas: item, method, requirement, batch1 text, batch2 text
    const name = '检验项目' + (ri + 1)
    setVal(tas[0], name)
    setVal(tas[1], '检验方法' + (ri + 1) + '：将样品放置在测试台上，按标准流程进行测试并记录读数，重复三次取平均值。')
    setVal(tas[2], '检验要求' + (ri + 1) + '：外观无破损、无划痕、尺寸在公差范围内，性能满足客户图纸与受控标准的要求。')
    setVal(tas[3], 'B1-项目' + (ri + 1))
    setVal(tas[4], 'B2-项目' + (ri + 1))
    res.push({ ri, tas: tas.length })
  })
  return res
})
console.log('filled:', JSON.stringify(filled))
await page.waitForTimeout(1200)
// 切换一次焦点触发渲染
await page.evaluate(() => document.body.click())
await page.waitForTimeout(800)
const dump = await page.evaluate(() => {
  const t = document.querySelector('.qr-grid')
  return [...t.querySelectorAll('tbody tr')].map((tr, ri) => ({
    ri,
    cells: [...tr.children].map((td, ci) => ({ ci, ta: [...td.querySelectorAll('textarea')].map((x) => x.value.slice(0, 20)), txt: (td.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 14) })),
  }))
})
console.log('grid after fill:', JSON.stringify(dump, null, 1))
// 保存
const saved = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn, button')].find((b) => (b.innerText || '').trim() === '保存')
  if (btn) { btn.click(); return true }
  return false
})
console.log('save clicked:', saved)
await page.waitForTimeout(4000)
console.log('msg:', await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((x) => (x.innerText || '').trim()).join(' | ')))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-11-saved.png' })
