/* _v-report-values.cjs — 看三张报表现在的实际数值(金额是否回到移动加权口径) */
const BASE = process.env.BASE || 'http://127.0.0.1:8090'
async function main() {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const token = (await lr.json())?.data?.token
  const post = async (body) => (await (await fetch(`${BASE}/api/px/queryFormDataList`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
  })).json())?.data
  const b = await post({ panelCode: 'STOCK_BALANCE', condition: {}, pageNo: 1, pageSize: 50, advFilters: [] })
  const nums = (b.list || []).map((r) => Number(r['结存金额'])).filter((n) => Number.isFinite(n))
  console.log(`STOCK_BALANCE totalSize=${b.totalSize} 本页行=${b.list.length} 本页结存金额合计=${nums.reduce((a, c) => a + c, 0).toFixed(2)}`)
  console.log('  前 3 行:', JSON.stringify((b.list || []).slice(0, 3).map((r) => ({
    仓库: r['仓库'], 存货编码: r['存货编码'], 现存量: r['现存量'], 结存单价: r['结存单价'], 结存金额: r['结存金额'],
  }))))
  const l = await post({ panelCode: 'STOCK_LEDGER', condition: {}, pageNo: 1, pageSize: 3, advFilters: [] })
  console.log('STOCK_LEDGER 前 3 行:', JSON.stringify((l.list || []).map((r) => ({
    存货编码: r['存货编码'], 单据类型: r['单据类型'], 收入金额: r['收入金额'], 发出金额: r['发出金额'], 期末金额: r['期末金额'],
  }))))
}
main().catch(e => { console.error(e); process.exit(1) })
