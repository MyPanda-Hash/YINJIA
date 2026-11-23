// round-38: 当前查询抽屉/按钮快照
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
console.log(JSON.stringify(await page.evaluate(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  return {
    hash: location.hash,
    drawer: !!document.querySelector('.el-drawer'),
    drawerCls: [...document.querySelectorAll('.el-drawer')].map((d) => String(d.className)),
    btns: [...document.querySelectorAll('button')].map((b) => ({ t: (b.innerText || '').trim().slice(0, 8), cls: String(b.className).slice(0, 40), ...rect(b) })).filter((b) => b.t),
    overlays: [...document.querySelectorAll('.el-overlay, .el-drawer__container, .el-drawer__body, .el-drawer__footer')].map((d) => ({ cls: String(d.className).slice(0, 60), ...rect(d) })),
  }
}), null, 1))
