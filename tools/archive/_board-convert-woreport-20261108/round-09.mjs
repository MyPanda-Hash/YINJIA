// round-09.mjs — 切 en 走查「备品超订单」新文案,结束后恢复原语言(不污染用户浏览器偏好)
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-board-freeze-20261108'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/prod/plan/orderConvert', { timeout: 40000 })
await page.waitForTimeout(4000)
const original = await page.evaluate(() => localStorage.getItem('mes_locale'))
console.log('original mes_locale=' + JSON.stringify(original))

try {
  // 切 en
  await page.evaluate(() => { localStorage.setItem('mes_locale', 'en'); location.reload() })
  await page.waitForTimeout(7000)
  // 打开页时「今日无数据→跳最近有数据一天」询问框(英文)
  const jump = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.el-message-box')]
    const b = boxes[boxes.length - 1]
    if (!b) return 'no-dialog'
    const btn = [...b.querySelectorAll('button')].find((x) => /jump|go/i.test((x.innerText || '').trim()))
    if (!btn) return 'no-jump: ' + (b.innerText || '').replace(/\s+/g, ' ').slice(0, 120)
    btn.click()
    return 'jumped'
  })
  console.log('jump: ' + jump)
  await page.waitForTimeout(4500)

  // 填一个超过剩余数量的值,读「超订单」小标 + tooltip 文案(应为英文)
  const info = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    for (const tr of rows) {
      const tds = [...tr.querySelectorAll('td')]
      const inp = tds[tds.length - 1]?.querySelector('input')
      if (!inp) continue
      const cur = Number(inp.value || 0)
      if (!Number.isFinite(cur) || cur <= 0) continue
      setVal(inp, String(cur + 100))
      return { before: cur }
    }
    return null
  })
  await page.waitForTimeout(1500)
  const en = await page.evaluate(() => {
    const tr = [...document.querySelectorAll('.el-table__body tbody tr')].find((x) => /Over order|超订单/.test(x.innerText || ''))
    if (!tr) return { found: false }
    const tds = [...tr.querySelectorAll('td')].length
    const cell = tr.querySelectorAll('td')[tds - 1]
    const inp = cell.querySelector('input')
    const wrap = inp ? inp.closest('.el-input-number') : null
    const heads = [...document.querySelectorAll('.el-table__header th')].map((t) => (t.innerText || '').replace(/\s+/g, ' ').trim())
    return {
      found: true,
      tag: (cell.innerText || '').replace(/\s+/g, ' ').trim(),
      title: wrap ? (wrap.getAttribute('title') || '') : '',
      headerOverQtyCol: heads[heads.length - 1] || '',
      pageButtons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter((t) => t && t.length < 20).slice(0, 12),
    }
  })
  console.log('en check: ' + JSON.stringify(en, null, 2))
  await page.screenshot({ path: OUT + '/round-09-en-over-order.png' })
} finally {
  // 恢复原语言(用户可能正在用这个浏览器)
  await page.evaluate((v) => {
    if (v == null) localStorage.removeItem('mes_locale')
    else localStorage.setItem('mes_locale', v)
    location.reload()
  }, original)
  await page.waitForTimeout(5000)
  const back = await page.evaluate(() => ({ locale: localStorage.getItem('mes_locale'), hash: location.hash }))
  console.log('restored: ' + JSON.stringify(back))
}
