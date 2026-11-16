/* round-16:完整可保存流程 —— 带入1个检验项目 + 填三行合并值 → 保存 → 截纸张图 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-module-20261116/'
const task = await taskSpace(1)
const page = (await task.pages())[0]
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(6000)
await page.evaluate(() => {
  window.__calls = []
  const XP = window.XMLHttpRequest.prototype
  const open = XP.open, send = XP.send
  XP.open = function (m, u, ...rest) { this.__m = m; this.__u = u; return open.call(this, m, u, ...rest) }
  XP.send = function (body) {
    const self = this
    const rec = { m: self.__m, u: String(self.__u), body: typeof body === 'string' ? body.slice(0, 300) : String(body || '') }
    window.__calls.push(rec)
    self.addEventListener('loadend', () => { rec.status = self.status; try { rec.resp = String(self.responseText || '').slice(0, 150) } catch (e) {} })
    return send.call(this, body)
  }
})
// 当前已选中的单据(左栏第一行)若为草稿则继续;否则点新增
let st = await page.evaluate(() => ({ docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length }))
console.log('state:', JSON.stringify(st))
if (!st.inputs) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '新增'); b && b.click() })
  await page.waitForTimeout(4000)
}
// ① 选择检验项目 → 勾第 1 行 → 带入
await page.evaluate(() => { const b = [...document.querySelectorAll('.ic-sheet button')].find((x) => (x.textContent || '').includes('选择检验项目')); b && b.click() })
await page.waitForTimeout(2500)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('从送样登记表选择检验项目'))
  if (!d) return { err: 'no dialog' }
  const rows = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  return { rows: rows.length, first: (rows[0]?.innerText || '').replace(/\s+/g, ' ').slice(0, 80) }
})
console.log('catalog dialog:', JSON.stringify(dlg))
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('从送样登记表选择检验项目'))
  const rows = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  rows.slice(0, 2).forEach((r) => { const cb = r.querySelector('.el-checkbox'); cb && cb.click() })
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('从送样登记表选择检验项目'))
  const b = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').includes('带入选中项'))
  b && b.click()
})
await page.waitForTimeout(1800)
const afterCarry = await page.evaluate(() => ({
  items: [...document.querySelectorAll('.ic-items tbody tr')].map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80)),
  category: (() => { const tr = [...document.querySelectorAll('.ic-grid tr')].find((t) => (t.querySelector('th')?.innerText || '').includes('检验类别')); return (tr?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 100) })(),
}))
console.log('after carry:', JSON.stringify(afterCarry))

// ② 填三行合并值 + 样品/联系人
const filled = await page.evaluate(() => {
  function setNative(inp, v) {
    const proto = inp.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(inp, v)
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const out = []
  for (const [th, v0, v1] of [
    ['委托单位/单位地址', '惠州测试委托单位(2026-11-16 走查)', '惠州市惠城区测试路 8 号'],
    ['制造商/地址', '惠州测试制造商', '惠州市惠阳区制造路 1 号'],
    ['生产厂/地址', '惠州测试生产厂', '惠州市仲恺高新区生产路 2 号'],
  ]) {
    const tr = [...document.querySelectorAll('.ic-grid tr')].find((t) => (t.querySelector('th')?.innerText || '').replace(/\s+/g, ' ').trim().startsWith(th))
    const ins = [...tr.querySelectorAll('input')]
    setNative(ins[0], v0); setNative(ins[1], v1)
    out.push({ th, n: ins.length })
  }
  const rowOf = (t) => [...document.querySelectorAll('.ic-grid tr')].find((r) => (r.querySelector('th')?.innerText || '').replace(/\s+/g, ' ').trim().startsWith(t))
  const r1 = rowOf('样品名称'); const i1 = [...r1.querySelectorAll('input')]; setNative(i1[0], '反渗透净水器出水'); setNative(i1[1], 'YINJIA'); setNative(i1[2], '2L')
  const r2 = rowOf('联系人'); const i2 = [...r2.querySelectorAll('input')]; setNative(i2[0], '李四'); setNative(i2[1], '13900001111'); setNative(i2[2], 'ui-test@example.com')
  return out
})
console.log('filled rows:', JSON.stringify(filled))
await page.waitForTimeout(800)

async function shotPaper(file, scale = 1.3) {
  const url = await page.evaluate(async (sc) => {
    const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
    const el = document.querySelector('.ic-sheet')
    const w0 = Math.max(el.scrollWidth, el.offsetWidth)
    const h0 = Math.max(el.scrollHeight, el.offsetHeight)
    return await m.domToPng(el, { scale: sc, backgroundColor: '#ffffff', width: w0, height: h0 })
  }, scale)
  if (url.err) { console.log('SHOT FAIL', url.err); return }
  await fs.writeFile(OUT + file, Buffer.from(String(url).split(',')[1], 'base64'))
  console.log('shot', file)
}
await shotPaper('round-16-filled.png')

// ③ 真实点击保存
try { await page.click('.approval-side .as-side-btn:text-is("保存")', { label: 'click save' }); console.log('save clicked') } catch (e) { console.log('save click fail: ' + e.message) }
await page.waitForTimeout(5000)
const out = await page.evaluate(() => ({
  calls: (window.__calls || []).map((c) => ({ m: c.m, u: String(c.u).replace(location.origin, ''), s: c.status })).slice(-8),
  toasts: [...document.querySelectorAll('.el-message')].map((e) => e.textContent.trim()),
  docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(),
  boxes: [...document.querySelectorAll('.el-message-box')].filter((e) => e.offsetWidth).map((e) => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 150)),
}))
console.log('after save:', JSON.stringify(out, null, 2))
