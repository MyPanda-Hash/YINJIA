/* round-06.mjs — 复现「首次进入明细表 0 条」:钩住 XHR → 切面板再回来 → 看那几次请求 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.evaluate(() => {
  window.__hooked2 = true
  window.__log = []
  const origOpen = XMLHttpRequest.prototype.open
  const origSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__u = u; this.__m = m; return origOpen.call(this, m, u, ...rest) }
  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener('loadend', () => {
      try {
        if (String(this.__u || '').includes('/px/queryFormDataList')) {
          let total = null
          try { total = JSON.parse(this.responseText).data.totalSize } catch (e) { }
          window.__log.push({ status: this.status, total, body: String(body || '').slice(0, 300) })
        }
      } catch (e) { }
    })
    return origSend.call(this, body)
  }
})

// 先从当前面板切走,再切回明细表(SPA 内跳转,不整页刷新)
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 30000 })
await page.waitForTimeout(4000)

const log = await page.evaluate(() => (window.__log || []).filter((x) => x.body.includes('QC_INSP_REC_DETAIL')))
const state = await page.evaluate(() => {
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const pager = [...document.querySelectorAll('.el-pagination')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim())
  return { rowCount: bodyRows.length, pager, hash: location.hash }
})
console.log(JSON.stringify({ log, state }, null, 2))
