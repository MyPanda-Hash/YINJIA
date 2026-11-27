const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')

// 展开「品质管理 > 来料品质」,核对菜单叶子;再展开「智能供应链 > 采购管理 > 单据」确认特采单已不在
const result = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const clickText = (txt) => {
    const el = [...document.querySelectorAll('.el-sub-menu__title, .el-menu-item')]
      .find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim().startsWith(txt))
    if (el) { el.click(); return true }
    return false
  }
  clickText('品质管理'); await sleep(500)
  clickText('来料品质'); await sleep(900)
  const qc = [...document.querySelectorAll('.el-menu-item')]
    .map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  clickText('智能供应链'); await sleep(500)
  clickText('采购管理'); await sleep(500)
  clickText('单据'); await sleep(900)
  const scm = [...document.querySelectorAll('.el-menu-item')]
    .map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  return { qcMenu: qc, scmMenu: scm }
})
console.log('QC-MENU', JSON.stringify(result.qcMenu, null, 0))
console.log('SCM-MENU', JSON.stringify(result.scmMenu, null, 0))
console.log('来料品质里有不合格品处理单(来料)=', result.qcMenu.some((t) => t.includes('不合格品处理单(来料)')))
console.log('采购管理下还有特采单=', result.scmMenu.some((t) => t === '特采单'))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-ngflow-20261128/round-10-menu.png' })
