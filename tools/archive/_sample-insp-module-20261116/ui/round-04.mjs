/* round-04:样品检验一级模块走查 —— 左侧导航顺序/展开子项 + 打开检验委托单列表 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-module-20261116/'
const task = await taskSpace(1)
const page = (await task.pages())[0]
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)

// ① 左侧导航:一级目录顺序 + 是否有「样品检验」
const nav = await page.evaluate(() => {
  const root = document.querySelector('.leftnav .nav-scroll') || document.querySelector('.leftnav')
  const tops = []
  for (const el of document.querySelectorAll('.leftnav .nav-item, .leftnav .nav-group, .leftnav .nav-parent, .leftnav .menu-item')) {
    tops.push({ cls: (typeof el.className === 'string' ? el.className : '').slice(0, 50), txt: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) })
  }
  return { tops: tops.slice(0, 40), text: (root?.innerText || '').replace(/\n+/g, '|') }
})
console.log('NAV:', JSON.stringify(nav, null, 2))

// ② 点开「样品检验」看子项
const hit = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.leftnav *')].filter((e) => (e.textContent || '').trim() === '样品检验')
  const el = els[els.length - 1]
  if (!el) return false
  el.click()
  return true
})
await page.waitForTimeout(1200)
const sub = await page.evaluate(() => {
  const t = (document.querySelector('.leftnav')?.innerText || '').replace(/\n+/g, '|')
  return { clicked: true, text: t }
})
console.log('NAV after expand:', JSON.stringify(sub))

// ③ 截图左侧导航(CDP 截图;失败则 domToPng)
try {
  const p = OUT + 'round-04-nav.png'
  await page.screenshot({ path: p })
  console.log('shot', p)
} catch (e) {
  console.log('cdp shot fail: ' + e.message)
  const url = await page.evaluate(async () => {
    const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
    const el = document.querySelector('.leftnav')
    const w0 = Math.max(el.scrollWidth, el.offsetWidth)
    const h0 = Math.max(el.scrollHeight, el.offsetHeight, 500)
    return await m.domToPng(el, { scale: 1.5, backgroundColor: '#ffffff', width: w0, height: h0 })
  })
  await fs.writeFile(OUT + 'round-04-nav.png', Buffer.from(String(url).split(',')[1], 'base64'))
  console.log('shot domToPng round-04-nav.png')
}

// ④ 列表页信息(测试账套应 0 单)
const list = await page.evaluate(() => ({
  hash: location.hash,
  title: (document.querySelector('.panelx-list .panel-title, .panelx-list h2, .func-zone')?.textContent || '').trim().slice(0, 120),
  buttons: [...document.querySelectorAll('.panelx-list button, .func-zone button')].map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 25),
  rows: document.querySelectorAll('.el-table__body-wrapper tbody tr').length,
}))
console.log('LIST:', JSON.stringify(list))
