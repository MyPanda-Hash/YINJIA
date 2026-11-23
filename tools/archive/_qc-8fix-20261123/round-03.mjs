// round-03: 新建草稿 → 新增两个检验项 → 添加批次 → 填值, 观察值落在哪个格子
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(7000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const clickText = async (sel, text) => {
  const ok = await page.evaluate(({ sel, text }) => {
    const el = [...document.querySelectorAll(sel)].find((x) => (x.innerText || '').replace(/\s+/g, '').includes(text))
    if (el) { el.click(); return true }
    return false
  }, { sel, text })
  console.log('click', sel, text, ok)
  await page.waitForTimeout(1200)
}

// 新建单据
await clickText('.as-side-btn', '新增')
await page.waitForTimeout(2000)
// 若弹出未保存确认, 选择放弃/不保存
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-message-box__btns button')].find((b) => /放弃|不保存|确定/.test(b.innerText || ''))
  if (btn) btn.click()
})
await page.waitForTimeout(800)

const band = () => page.evaluate(() => (document.querySelector('.qr-band')?.innerText || '').replace(/\s+/g, ' ').trim())
console.log('band1:', await band())

for (let i = 0; i < 2; i++) {
  const ok = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.qr-band-act')].find((x) => (x.innerText || '').includes('新增检验项'))
    if (el) { el.click(); return true }
    return false
  })
  console.log('addItem', i, ok)
  await page.waitForTimeout(1200)
}
console.log('band2:', await band())

const okBatch = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-band-act')].find((x) => (x.innerText || '').includes('添加批次'))
  if (el) { el.click(); return true }
  return false
})
console.log('addBatch', okBatch)
await page.waitForTimeout(1500)

const dump = () => page.evaluate(() => {
  const t = document.querySelector('.qr-grid')
  if (!t) return { err: 'no .qr-grid' }
  return {
    head: [...t.querySelectorAll('thead tr')].map((tr) => [...tr.children].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim())),
    rows: [...t.querySelectorAll('tbody tr')].map((tr, ri) => ({
      ri,
      cells: [...tr.children].map((td, ci) => ({
        ci,
        text: (td.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30),
        ta: [...td.querySelectorAll('textarea')].map((x) => x.value),
        inps: [...td.querySelectorAll('input')].map((x) => x.value),
        sel: [...td.querySelectorAll('.el-select')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 16)),
      })),
    })),
  }
})
console.log('=== GRID AFTER ADD BATCH ===')
console.log(JSON.stringify(await dump(), null, 1))

// 在每一个 textarea 里写入可识别值
const typed = await page.evaluate(() => {
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const s = Object.getOwnPropertyDescriptor(proto, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const out = []
  const t = document.querySelector('.qr-grid')
  ;[...t.querySelectorAll('tbody tr')].forEach((tr, ri) => {
    ;[...tr.querySelectorAll('textarea')].forEach((ta, ti) => {
      const v = 'R' + ri + 'C' + ti
      setVal(ta, v)
      out.push({ ri, ti, v })
    })
  })
  return out
})
console.log('=== TYPED ===', JSON.stringify(typed))
await page.waitForTimeout(1500)
console.log('=== GRID AFTER TYPING ===')
console.log(JSON.stringify(await dump(), null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-03-after-typing.png' })
