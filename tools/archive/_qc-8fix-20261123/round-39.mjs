// round-39: 精确定位抽屉里的主按钮 + 用 page.click 的 loc 选择器
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
console.log(JSON.stringify(await page.evaluate(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  const all = [...document.querySelectorAll('button')].filter((b) => (b.innerText || '').trim() === '查询')
  return all.map((b) => ({
    cls: String(b.className), ...rect(b),
    parent: String(b.parentElement?.className || ''),
    gp: String(b.parentElement?.parentElement?.className || ''),
    inDrawer: !!b.closest('.el-drawer'),
    disabled: b.disabled,
    display: getComputedStyle(b).display,
    pe: getComputedStyle(b).pointerEvents,
  }))
}), null, 1))
