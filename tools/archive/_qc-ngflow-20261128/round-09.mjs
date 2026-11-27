const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')

// ① 菜单:品质管理 > 来料品质 里应有「不合格品处理单(来料)」
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_TC_IN?docNo=TCI-2026-11-0007', { timeout: 60000 })
await page.waitForTimeout(4500)

const info = await page.evaluate(() => {
  const pick = (sel) => [...document.querySelectorAll(sel)].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
  const menuText = pick('.el-menu .el-sub-menu__title, .el-menu li')
  return {
    hash: location.hash,
    // 左侧选择栏 + 纸面标题
    titleTexts: pick('[class*="as-title"], [class*="rsp-title"], .as-docno, [class*="docno"]').slice(0, 8),
    menuHasNew: menuText.some((t) => t.includes('不合格品处理单(来料)')),
    menuHasOld: menuText.some((t) => t === '特采单'),
    heading: document.querySelector('.as-wrap, .rsp-wrap, .page-card')?.innerText.slice(0, 600) || document.body.innerText.slice(0, 600),
  }
})
console.log('MENU+TITLE', JSON.stringify(info, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-ngflow-20261128/round-09-ng-paper.png' })
