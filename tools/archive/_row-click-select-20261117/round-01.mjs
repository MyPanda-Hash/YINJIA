// round-01.mjs — 探路:四个页面(订单结转/生产工单/工单排产/快速排产)能否打开、有没有行
// 由 ego-browser nodejs 执行:evidence 目录 = tools/archive/_row-click-select-20261117/
const task = await taskSpace('yinjia-rowclick-select-20261117')
const page = task.page('p1')

const probe = async (hash) => {
  await page.goto('http://localhost:5173/#' + hash, { timeout: 30000 })
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const onLogin = !!document.querySelector('input[placeholder*="账号"]') || location.hash.includes('login')
    const tables = [...document.querySelectorAll('.el-table')].map((t, i) => ({
      i,
      rows: t.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length,
    }))
    return {
      hash: location.hash,
      onLogin,
      tables,
      emptyText: [...document.querySelectorAll('.oc-empty, .el-table__empty-text, .el-table__empty-block')]
        .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70)).slice(0, 4),
    }
  })
  console.log(hash, JSON.stringify(out))
  return out
}

const pages = { 订单结转: '/prod/plan/orderConvert', 生产工单: '/prod/plan/workOrderList', 工单排产: '/prod/plan/workOrderBoard', 快速排产: '/prod/plan/scheduleBoard' }
for (const [name, hash] of Object.entries(pages)) {
  const r = await probe(hash)
  console.log('   ↳', name, r.onLogin ? '需要登录/已过期' : '已登录')
}
