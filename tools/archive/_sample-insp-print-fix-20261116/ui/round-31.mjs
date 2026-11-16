/* round-31:html2canvas 对「已填值」的输入框渲染验证 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-print-fix-20261116/'
const task = await taskSpace(7)
const page = (await task.pages())[0]
const r = await page.evaluate(async () => {
  const setNative = (inp, v) => {
    const proto = inp.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(inp, v)
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const el = document.querySelector('.ic-sheet')
  const rows = [...el.querySelectorAll('.ic-grid tr')]
  const row = (t) => rows.find((r) => (r.querySelector('th')?.innerText || '').replace(/\s+/g, ' ').trim().startsWith(t))
  const setRow = (t, vals) => { const ins = [...(row(t)?.querySelectorAll('input') || [])]; vals.forEach((v, i) => { if (ins[i]) setNative(ins[i], v) }) }
  setRow('委托单位/单位地址', ['联调委托单位', '惠州市测试路 1 号'])
  setRow('制造商/地址', ['联调制造商', '惠州市测试路 2 号'])
  setRow('生产厂/地址', ['联调生产厂', '惠州市测试路 3 号'])
  setRow('联系人', ['张三', '13800000000', 'a@b.c'])
  setRow('样品名称', ['测试样品', 'TM', '2L'])
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const mod = await import('/@fs/D:/workspace/yinjia/frontend/node_modules/html2canvas/dist/html2canvas.esm.js')
  const h2c = mod.default || mod
  const canvas = await h2c(el, { backgroundColor: '#ffffff', scale: 2, logging: false, width: el.scrollWidth, height: el.scrollHeight, windowWidth: 1600 })
  return { url: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height }
})
await fs.writeFile(OUT + 'h2c-filled.png', Buffer.from(String(r.url).split(',')[1], 'base64'))
console.log('saved h2c-filled.png', r.w, r.h)
