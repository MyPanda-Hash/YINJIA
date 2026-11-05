// round-40: 版式回归 —— 3 行单据(单页) + 13 行单据(自动续页)
const task = await taskSpace(1)
const page = task.page('p1')
await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 30000 })
await page.waitForTimeout(3000)

const post = async (wo, rows) => page.evaluate(async ({ wo, rows }) => {
  const token = localStorage.getItem('mes_token') || ''
  const body = {
    类型: 'PICK_SLIP', 标题: '生产领料单', 工单号: wo, 工单行号: 1,
    产品名称: '版式测试', 领料单号: 'LL-LAYOUT-' + rows, 领料部门: '成型1线',
    打印日期: new Date().toLocaleDateString('zh-CN'), 来源: 'verify',
    明细: Array.from({ length: rows }, (_, i) => ({
      材料名称: '测试材料' + (i + 1), 规格: '100*200', 单位: '张', 请领数量: (i + 1) * 2, 实发数量: i + 1, 备注: '',
    })),
  }
  const r = await fetch('/api/px/print/enqueue', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  return { wo, queued: j?.data?.queued, targets: j?.data?.targets }
}, { wo, rows })

console.log(JSON.stringify(await post('GD-LAYOUT-3', 3)))
await page.waitForTimeout(9000)
console.log(JSON.stringify(await post('GD-LAYOUT-13', 13)))
await page.waitForTimeout(12000)
console.log(JSON.stringify(await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/print/station', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  return { queueSize: j?.data?.queueSize, recent: (j?.data?.recent || []).slice(0, 3).map((x) => x.工单号 + ' ' + x.来源) }
}), null, 2))
