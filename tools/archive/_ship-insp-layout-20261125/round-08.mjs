// 第 8 轮:填 3 行判定(合格) → 保存 → 直接审核 → 只读态取证
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')

const clickAs = async (label, scope = '.as-side-btns') => {
  const ok = await page.evaluate(([t, sc]) => {
    const el = [...document.querySelectorAll(sc + ' .as-side-btn')]
      .find((e) => (e.textContent || '').trim() === t)
    if (!el) return false
    el.click()
    return true
  }, [label, scope])
  await page.waitForTimeout(1500)
  return ok
}

// 关掉上一个未关的确认框
const boxBtn = async (label) => {
  const ok = await page.evaluate((t) => {
    const b = document.querySelector('.el-message-box')
    if (!b) return false
    const el = [...b.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === t)
    if (!el) return false
    el.click()
    return true
  }, label)
  await page.waitForTimeout(1200)
  return ok
}
console.log('close msgbox: ' + (await boxBtn('取消')))

// 每行结果判断选「合格」
for (let i = 0; i < 3; i++) {
  const opened = await page.evaluate((idx) => {
    const sel = document.querySelectorAll('.qr-grid tbody tr')[idx]?.querySelector('.c-result .el-select')
    if (!sel) return false
    sel.querySelector('.el-select__wrapper')?.click()
    return true
  }, i)
  await page.waitForTimeout(700)
  const picked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
      .filter((el) => el.getBoundingClientRect().height > 0)
    const hit = items.find((el) => (el.textContent || '').trim() === '合格')
    if (!hit) return false
    hit.click()
    return true
  })
  await page.waitForTimeout(600)
  console.log('row ' + i + ' select opened=' + opened + ' picked=' + picked)
}
await page.waitForTimeout(800)

const state = async (tag) => {
  const s = await page.evaluate(() => {
    const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
    const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
    const cell = (td) => {
      if (!td) return null
      const inner = td.querySelector('.qr-cell-text') || td.querySelector('textarea') || td.querySelector('.el-select') || td.querySelector('.qr-row-del') || td.firstElementChild
      const ir = inner ? inner.getBoundingClientRect() : null
      const r = td.getBoundingClientRect()
      const cs = inner ? getComputedStyle(inner) : null
      return {
        cw: Math.round(r.width), ch: Math.round(r.height),
        iw: ir ? Math.round(ir.width) : null, ih: ir ? Math.round(ir.height) : null,
        topGap: ir ? Math.round(ir.top - r.top) : null,
        align: cs?.textAlign, vAlign: getComputedStyle(td).verticalAlign, ws: cs?.whiteSpace,
        v: inner ? (inner.tagName === 'TEXTAREA' ? inner.value : txt(inner)) : null,
      }
    }
    return {
      editing: !!document.querySelector('.qr-sheet.is-editing'),
      status: txt(document.querySelector('.as-side-status-row') || {}),
      batchHeads: [...document.querySelectorAll('.c-batchname')].map((th) => ({ text: txt(th), input: th.querySelector('input')?.value ?? null })),
      rowH: rows.map((tr) => Math.round(tr.getBoundingClientRect().height)),
      rows: rows.map((tr) => [...tr.children].map(cell)),
    }
  })
  console.log('== ' + tag + ' ==\n' + JSON.stringify(s))
  return s
}
console.log('save: ' + (await clickAs('保存')))
await state('保存后(应仍是草稿/可编辑)')

console.log('审核: ' + (await clickAs('审核')))
await page.waitForTimeout(1200)
console.log('确认审核: ' + (await boxBtn('确认审核')))
await page.waitForTimeout(2500)
await state('审核后(只读)')
const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(400)
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-08.png' })
