// round-36: 只看查询面板按钮/落点
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
console.log(JSON.stringify(await page.evaluate(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) } }
  return {
    btns: [...document.querySelectorAll('button, .el-button')].filter((b) => ['查询', '重置', '取消'].includes((b.innerText || '').trim())).map((b) => ({ t: b.innerText.trim(), cls: String(b.className), disabled: b.disabled, ...rect(b) })),
    atPoint: (() => { const el = document.elementFromPoint(1023, 672); return el ? { tag: el.tagName, cls: String(el.className).slice(0, 60), text: (el.innerText || '').trim().slice(0, 10) } : null })(),
    drawer: (() => { const d = document.querySelector('.el-drawer, .query-panel, .filter-drawer'); return d ? { cls: String(d.className), ...rect(d) } : null })(),
  }
}), null, 1))
