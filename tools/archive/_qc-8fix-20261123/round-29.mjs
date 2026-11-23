// round-29: 鼠标操作前置探查——菜单/左栏/单据行的可点区域
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.goto('http://127.0.0.1:8090/?mm=' + Date.now() + '#/panelx/list/QC_BHC', { timeout: 60000 })
await page.waitForTimeout(7000)
const info = await page.evaluate(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) } }
  const pick = (txt, max = 5) => [...document.querySelectorAll('*')].filter((n) => n.children.length === 0 && (n.textContent || '').trim() === txt).slice(0, max).map((n) => ({ txt, tag: n.tagName, cls: String(n.className).slice(0, 40), ...rect(n), parent: String(n.parentElement?.className || '').slice(0, 50) }))
  return {
    menu: ['品质管理', '制程品质', '出货检验（功能）明细表', '不合格品处理单(制程)'].map((t) => pick(t)),
    railRow: (() => { const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('BHC-2026-09-0001')); return tr ? { cls: String(tr.className), ...rect(tr) } : null })(),
    infoRows: [...document.querySelectorAll('.as-info-row')].map((r) => ({ text: (r.innerText || '').replace(/\s+/g, ' ').trim(), ...rect(r) })),
  }
})
console.log(JSON.stringify(info, null, 1))
