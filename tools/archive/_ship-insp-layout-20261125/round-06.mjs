// 第 6 轮:提交审核 + 审核 → 只读态取证(批次号是否还在、各行对齐是否一致)
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
const clickSide = async (label) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('.approval-side *, .tools *')]
      .filter((e) => (e.textContent || '').trim() === t && e.children.length === 0)
      .find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
    if (!el) return false
    el.click()
    return true
  }, label)
  await page.waitForTimeout(3000)
  const msgs = await page.evaluate(() => [...document.querySelectorAll('.el-message, .el-message-box')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()))
  console.log('click ' + label + ' -> ' + ok + ' | msg=' + JSON.stringify(msgs))
  return ok
}

const report = async (tag) => {
  const s = await page.evaluate(() => {
    const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
    const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
    const cellBox = (td) => {
      if (!td) return null
      const r = td.getBoundingClientRect()
      const inner = td.querySelector('.qr-cell-text') || td.querySelector('textarea') || td.querySelector('.el-select') || td.firstElementChild
      const ir = inner ? inner.getBoundingClientRect() : null
      const cs = inner ? getComputedStyle(inner) : null
      return {
        cell: { w: Math.round(r.width), h: Math.round(r.height) },
        inner: ir ? { w: Math.round(ir.width), h: Math.round(ir.height), top: Math.round(ir.top - r.top) } : null,
        textAlign: cs ? cs.textAlign : null,
        verticalAlign: getComputedStyle(td).verticalAlign,
        whiteSpace: cs ? cs.whiteSpace : null,
        content: inner ? (inner.tagName === 'TEXTAREA' ? inner.value : txt(inner)) : '',
      }
    }
    return {
      editable: !!document.querySelector('.qr-sheet.is-editing'),
      batchHead: [...document.querySelectorAll('.c-batchname')].map((th) => ({
        text: txt(th),
        input: th.querySelector('input')?.value ?? null,
        html: th.innerHTML.replace(/\s+/g, ' ').slice(0, 260),
      })),
      rowHeights: rows.map((tr) => Math.round(tr.getBoundingClientRect().height)),
      row1: [...(rows[0]?.children || [])].map(cellBox),
      row2: [...(rows[1]?.children || [])].map(cellBox),
      row3: [...(rows[2]?.children || [])].map(cellBox),
    }
  })
  console.log('== ' + tag + ' ==\n' + JSON.stringify(s, null, 2))
}

await report('提交前')
await clickSide('提交审核')
await page.waitForTimeout(1500)
await report('提交后')
await clickSide('审核')
await page.waitForTimeout(2000)
await report('审核后')
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-06.png' })
