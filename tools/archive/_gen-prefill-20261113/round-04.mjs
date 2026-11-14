// round-04: 打印 WH / WHLOC 接口返回的**行结构**(不打印全部数据,只看 key 与首行摘要)
const task = await taskSpace('gen-noscroll-prefill-20261113')
const page = task.page('p1')
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
async function q(panelCode) {
  const res = await page.fetch('/api/px/queryFormDataList', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode, condition: {}, pageNo: 1, pageSize: 3 }),
  })
  const body = JSON.parse(String(res.body || '{}'))
  const list = body?.data?.list || []
  const r0 = list[0] || {}
  const detailKeys = r0.detail && typeof r0.detail === 'object' ? Object.keys(r0.detail) : []
  const item0 = detailKeys.length ? (r0.detail[detailKeys[0]] || [])[0] : null
  return {
    panel: panelCode, status: res.status, code: body?.code, total: body?.data?.totalSize, n: list.length,
    rowKeys: Object.keys(r0).slice(0, 12), detailKeys,
    itemKeys: item0 ? Object.keys(item0).slice(0, 16) : null,
  }
}
console.log('WH    ' + JSON.stringify(await q('WH')))
console.log('WHLOC ' + JSON.stringify(await q('WHLOC')))
