// round-02:逐个打开新增页面,记录是否正常渲染 / 有无报错
const task = await taskSpace('local-migrate-20261117')
const page = task.page('p1')

const routes = [
  ['销售退货单', '/panelx/list/SALE_IN'],
  ['生产退料单', '/panelx/list/MATERIAL_RET'],
  ['生产领料明细表', '/panelx/list/PROD_PICK_LIST'],
  ['生产退料明细表', '/panelx/list/PROD_RET_LIST'],
  ['手机生产退料', '/panelx/list/MOBILE_RETURN'],
  ['扫码混料', '/panelx/list/MOBILE_MIX_SCAN'],
]

const out = []
for (const [name, path] of routes) {
  await page.goto('http://localhost:5173/#' + path, { timeout: 60000 })
  await page.waitForTimeout(5000)
  const st = await page.evaluate(() => {
    const txt = document.body.innerText || ''
    const tblRows = document.querySelectorAll('.el-table__body tr').length
    const errs = []
    if (/Invalid object name|列名 .* 无效|500|请求失败|加载失败/.test(txt)) errs.push((txt.match(/[^\n]*(Invalid object name|列名 .* 无效|500|请求失败|加载失败)[^\n]*/g) || []).slice(0, 2))
    return {
      hash: location.hash,
      title: (document.querySelector('.tabsbar .tab-active, .tabsbar .tab') ?.textContent || '').trim() ||
             (document.querySelector('.func-zone')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      rows: tblRows,
      hasTable: !!document.querySelector('.el-table'),
      empty: /暂无数据|空/.test(txt),
      errs,
      textSample: txt.replace(/\s+/g, ' ').slice(0, 160),
    }
  })
  out.push({ name, path, ...st })
}
console.log(JSON.stringify(out, null, 2))
