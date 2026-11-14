/* round-11:检验委托单 全链路 UI 走查(测试账套 YJ_TEST)
 *   新增 → 选择检验项目(从送样登记表带入) → 截图 → 填表头 → 保存 → 提交审批 → 审批通过
 *   → 断言状态/审核人/左栏/审批情况 → 打印态高度 → 截图(domToPng 栅格化,绕过 CDP 截图)
 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-20261115/'
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => s.name === 'sample-insp-20261115')
const task = entry.ownership === 'user' ? await claimTaskSpace(entry.id) : await taskSpace(entry.id)
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))
const log = (...a) => console.log(...a)

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(6000)

/* ---------- helpers(browser 侧) ---------- */
async function shot(selector, file, scale = 1.4) {
  const r = await page.evaluate(async (sel) => {
    const el = document.querySelector(sel)
    if (!el) return { err: 'no element ' + sel }
    const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
    const holder = document.createElement('div')
    const w0 = Math.max(el.scrollWidth, el.offsetWidth)
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + w0 + 'px;background:#fff;'
    const clone = el.cloneNode(true)
    clone.style.width = w0 + 'px'
    clone.style.maxWidth = 'none'
    clone.style.overflow = 'visible'
    clone.style.margin = '0'
    holder.appendChild(clone)
    document.body.appendChild(holder)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const h0 = Math.max(clone.scrollHeight, clone.offsetHeight)
    const url = await m.domToPng(clone, { scale: 1.4, backgroundColor: '#ffffff', width: w0, height: h0 })
    holder.remove()
    return { url, w: w0, h: h0 }
  }, selector)
  if (r.err) { log('SHOT FAIL', selector, r.err); return null }
  const buf = Buffer.from(String(r.url).split(',')[1], 'base64')
  await fs.writeFile(OUT + file, buf)
  log('shot', file, r.w + 'x' + r.h, buf.length + 'B')
  return r
}
async function clickSide(text) {
  const r = await page.evaluate((t) => {
    const btns = [...document.querySelectorAll('.approval-side .as-side-btn')]
    const hit = btns.find((b) => (b.textContent || '').trim().startsWith(t))
    if (!hit) return { err: 'no side btn ' + t, have: btns.map((b) => b.textContent.trim()) }
    hit.click()
    return { ok: true }
  }, text)
  if (r.err) log('CLICK FAIL', JSON.stringify(r))
  return !!r.ok
}
async function confirmBox(text) {
  await page.waitForTimeout(900)
  const r = await page.evaluate((v) => {
    const box = document.querySelector('.el-message-box')
    if (!box) return { err: 'no message-box' }
    const ta = box.querySelector('textarea')
    if (ta && v) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(ta, v)
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const btns = [...box.querySelectorAll('button')]
    const primary = btns.find((b) => b.classList.contains('el-button--primary')) || btns[btns.length - 1]
    primary.click()
    return { ok: true, title: box.querySelector('.el-message-box__title')?.textContent || '' }
  }, text)
  log('confirmBox:', JSON.stringify(r))
  await page.waitForTimeout(1800)
}
async function setField(label, value) {
  const r = await page.evaluate(([lb, val]) => {
    const rows = [...document.querySelectorAll('.ic-grid tr')]
    for (const tr of rows) {
      const th = tr.querySelector('th')
      if (!th || !(th.textContent || '').trim().startsWith(lb)) continue
      const inp = tr.querySelector('input, textarea')
      if (!inp) return { err: 'no input in row ' + lb }
      const proto = inp.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(inp, val)
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      inp.dispatchEvent(new Event('change', { bubbles: true }))
      return { ok: true }
    }
    return { err: 'no row ' + lb }
  }, [label, value])
  if (r.err) log('SET FAIL', r.err)
  return !!r.ok
}
async function state() {
  return page.evaluate(() => ({
    docNo: (document.querySelector('.ic-meta-no')?.textContent || '').replace(/\s+/g, ' ').trim(),
    docDate: document.querySelector('.ic-date-text')?.textContent?.trim() || '',
    rows: document.querySelectorAll('.ic-items-table tbody tr').length || document.querySelectorAll('.ic-detail-table tbody tr').length,
    rowNames: [...document.querySelectorAll('.ic-items-table tbody tr, .ic-detail-table tbody tr')].map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80)),
    category: (() => {
      const rows = [...document.querySelectorAll('.ic-grid tr')]
      for (const tr of rows) {
        const th = tr.querySelector('th')
        if (th && (th.textContent || '').includes('检验类别')) return (tr.innerText || '').replace(/\s+/g, ' ').trim()
      }
      return ''
    })(),
    railStatus: [...document.querySelectorAll('.doc-select-rail .rail-row, .doc-select-rail tbody tr')].slice(0, 2).map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()),
    savedStatus: (() => {
      const el = [...document.querySelectorAll('.doc-select-rail *')].find((x) => /已审核|草稿|审批中/.test((x.textContent || '').trim()) && (x.textContent || '').trim().length < 12)
      return el ? el.textContent.trim() : ''
    })(),
    sideBtns: [...document.querySelectorAll('.approval-side .as-side-btn')].map((e) => e.textContent.trim()),
    editableInputs: document.querySelectorAll('.ic-sheet input').length,
  }))
}
const clickByText = async (sel, text) => {
  const r = await page.evaluate(([s, t]) => {
    const els = [...document.querySelectorAll(s)]
    const hit = els.find((e) => (e.textContent || '').trim().includes(t))
    if (!hit) return { err: 'no ' + t }
    hit.click(); return { ok: true }
  }, [sel, text])
  if (r.err) log('clickByText fail', text, r.err)
  return !!r.ok
}

/* ---------- ① 新增一张空白草稿 ---------- */
await clickSide('新增')
await page.waitForTimeout(4000)
log('after 新增:', JSON.stringify(await state()))
await shot('.ic-sheet', 'round-11-01-new-blank.png')

/* ---------- ② 选择检验项目:从送样登记表带入锂/钠/镁 ---------- */
const opened = await clickByText('.ic-sheet button', '选择检验项目')
log('open catalog:', opened)
await page.waitForTimeout(2500)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('从送样登记表选择检验项目'))
  if (!d) return { err: 'dialog not found' }
  const rows = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  return { rows: rows.length, first: rows.slice(0, 5).map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90)), visible: !!d.offsetWidth }
})
log('dialog:', JSON.stringify(dlg))
if (!dlg.err) await shot('.el-dialog', 'round-11-02-catalog-dialog.png', 1.2)
// 勾选前三行(锂/钠/镁)
const picked = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('从送样登记表选择检验项目'))
  if (!d) return { err: 'no dialog' }
  const rows = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 3)
  rows.forEach((r) => { const cb = r.querySelector('.el-checkbox'); if (cb) cb.click() })
  return { ok: rows.length, names: rows.map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30)) }
})
log('picked:', JSON.stringify(picked))
await page.waitForTimeout(600)
// 点「带入选中项」
const carried = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('从送样登记表选择检验项目'))
  if (!d) return { err: 'no dialog' }
  const btns = [...d.querySelectorAll('button')]
  const hit = btns.find((b) => (b.textContent || '').includes('带入选中项'))
  if (!hit) return { err: 'no carry btn', btns: btns.map((b) => b.textContent.trim()) }
  if (hit.disabled) return { err: 'carry disabled' }
  hit.click(); return { ok: true }
})
log('carry:', JSON.stringify(carried))
await page.waitForTimeout(1500)
const afterCarry = await state()
log('after carry:', JSON.stringify(afterCarry, null, 1))
await shot('.ic-sheet', 'round-11-03-after-carry.png', 1.6)

/* ---------- ③ 填表头 + 保存 ---------- */
for (const [lb, v] of [
  ['委托单位', '惠州测试委托单位(UI 走查)'],
  ['委托单位地址', '惠州市惠城区测试路 8 号'],
  ['制造商', '测试制造商'],
  ['联系人', '李四'],
  ['联系电话（手机）', '13900001111'],
  ['邮箱', 'ui-test@example.com'],
  ['样品名称', '反渗透净水器出水'],
  ['商标', 'YINJIA'],
  ['样品数量', '2L'],
  ['样品型号/规格', '500mL 瓶装'],
  ['检验项目及要求', '部分项目：金属元素（第 6 章）'],
  ['备注', 'UI 走查测试单据，可删'],
]) await setField(lb, v)
await page.waitForTimeout(400)
await shot('.ic-sheet', 'round-11-04-filled.png', 1.6)
await clickSide('保存')
await page.waitForTimeout(3500)
const afterSave = await state()
log('after save:', JSON.stringify(afterSave, null, 1))
await shot('.ic-sheet', 'round-11-05-saved.png', 1.6)

/* ---------- ④ 提交审批 → 审批通过 ---------- */
await clickSide('提交审批')
await confirmBox('UI 走查提交审批')
const afterSubmit = await state()
log('after submit:', JSON.stringify(afterSubmit.savedStatus), JSON.stringify(afterSubmit.railStatus))
await clickSide('审批通过')
await confirmBox('UI 走查审批通过')
await page.waitForTimeout(2500)
const afterApprove = await state()
log('after approve:', JSON.stringify(afterApprove, null, 1))
await shot('.ic-sheet', 'round-11-06-approved-readonly.png', 1.6)

/* ---------- ⑤ 审批情况 + 打印态高度 ---------- */
await clickSide('审批情况')
await page.waitForTimeout(1500)
const history = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => /审批/.test(x.innerText || ''))
  return d ? (d.innerText || '').replace(/\s+/g, ' ').slice(0, 500) : ''
})
log('approval history:', history)
const pr = await page.evaluate(async () => {
  document.body.classList.add('approval-printing')
  await new Promise((r) => setTimeout(r, 300))
  const el = document.querySelector('.ic-sheet')
  const h = el ? el.getBoundingClientRect().height : 0
  const w = el ? el.getBoundingClientRect().width : 0
  document.body.classList.remove('approval-printing')
  // A4 竖版 8mm 边距可打印内容区:194mm ≈ 733px 宽 / 281mm ≈ 1062px 高
  return { printH: Math.round(h), printW: Math.round(w), a4: { w: 733, h: 1062 } }
})
log('print metrics:', JSON.stringify(pr))
log('DONE')
