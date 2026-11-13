// round-09: 打印按钮坐标处的元素栈(谁盖住了),以及按钮所在表格的滚动/裁切状态
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
try { await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }) } catch (e) { /* ignore */ }
await page.waitForTimeout(800)
const stack = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('打印材料码'))
  const vis = all.filter((d) => d.getBoundingClientRect().width > 0)
  const d = vis[vis.length - 1]
  const po = [...d.querySelectorAll('.el-collapse-item')].find((it) => (it.textContent || '').includes('打印采购订单记录'))
  const btn = po ? [...po.querySelectorAll('button')].find((b) => (b.textContent || '').includes('按这次打印打码')) : null
  if (!btn) return { ok: false, items: [...d.querySelectorAll('.el-collapse-item__header')].map((h) => (h.textContent || '').trim().slice(0, 20)) }
  const r = btn.getBoundingClientRect()
  const x = r.x + r.width / 2
  const y = r.y + r.height / 2
  const stackAt = document.elementsFromPoint(x, y).slice(0, 6).map((el) => ({
    tag: el.tagName, cls: (el.className || '').toString().slice(0, 50), txt: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24),
  }))
  return {
    ok: true,
    btnRect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    stackAt,
    btnVisible: !!(btn.offsetWidth || btn.offsetHeight),
    poTableMaxH: (po.querySelector('.el-table')?.style?.maxHeight) || getComputedStyle(po.querySelector('.el-table') || btn).maxHeight,
    wrapRect: (() => { const w = po.querySelector('.el-collapse-item__wrap'); if (!w) return null; const wr = w.getBoundingClientRect(); return [Math.round(wr.x), Math.round(wr.y), Math.round(wr.width), Math.round(wr.height)] })(),
    winScrollY: window.scrollY,
  }
})
console.log(JSON.stringify(stack, null, 2))
