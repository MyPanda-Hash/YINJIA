/**
 * 探针(API 层):我的桌面「销售」模块的取数不变量(只读,不改数据)
 * ① 趋势:近 30 天按日(30 个点),added 合计 = 库内近 30 天订单数
 * ② 金额维度:客户/产品排行榜各有金额口径,且客户金额合计 = 全量金额
 * ③ 甜甜圈口径:客户分布各片**合计必须等于订单总数**(不能只算 TOP6 的 98)
 */
const API = process.env.YINJIA_API || 'http://127.0.0.1:8090/api'
const FACTORY = process.env.YINJIA_FACTORY || 'YJ_TEST'
let fails = 0
const chk = (id, name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} [${id}] ${name}${detail === undefined ? '' : '  → ' + detail}`)
  if (!ok) fails++
}
const sum = (a) => (a || []).reduce((s, x) => s + Number(x.value || 0), 0)

async function main() {
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
  })
  const tok = (await lr.json())?.data?.token
  if (!tok) throw new Error('登录失败')
  const s = (await (await fetch(API + '/dashboard/stats', { headers: { Authorization: 'Bearer ' + tok } })).json()).data.sales

  console.log(`[现状] total=${s.total} amount=${s.amount} trend7=${(s.trend7 || []).length} 点 ` +
    `byCustomer 合计=${sum(s.byCustomer)} topProducts=${(s.topProducts || []).length} 条`)
  console.log(`       新字段: trend30=${(s.trend30 || []).length} customerShare=${(s.customerShare || []).length} ` +
    `customerShareAmount=${(s.customerShareAmount || []).length} topProductsAmount=${(s.topProductsAmount || []).length}`)

  // ① 趋势:近 30 天
  chk('S1', 'trend30 存在且有 30 个点', (s.trend30 || []).length === 30, `${(s.trend30 || []).length} 点`)
  const addedSum = (s.trend30 || []).reduce((a, d) => a + Number(d.added || 0), 0)
  chk('S2', 'trend30 的 added 合计 = 近 30 天订单数(157)', addedSum === 157, `合计=${addedSum}`)
  chk('S3', 'trend30 每天都有 date/added/done 三字段',
    (s.trend30 || []).every((d) => d.date && d.added !== undefined && d.done !== undefined))

  // ③ 甜甜圈口径:合计必须等于订单总数(修前只有 TOP6 = 98)
  const shareSum = sum(s.customerShare)
  chk('S4', '客户分布(customerShare)各片合计 = 订单总数', shareSum === s.total, `合计=${shareSum} / total=${s.total}`)
  chk('S5', '客户分布含「其它」或「未填客户」聚合成片(把 TOP6 之外的单也算进来)',
    (s.customerShare || []).some((x) => x.name === '其它' || x.name === '未填客户'),
    JSON.stringify((s.customerShare || []).map((x) => x.name)))

  // ② 金额维度
  chk('S6', 'topProductsAmount 存在且 8 条以内', (s.topProductsAmount || []).length > 0 && s.topProductsAmount.length <= 8,
    `${(s.topProductsAmount || []).length} 条`)
  const amtSorted = (s.topProductsAmount || []).every((x, i, a) => i === 0 || a[i - 1].value >= x.value)
  chk('S7', 'topProductsAmount 按金额降序', amtSorted)
  const shareAmtSum = sum(s.customerShareAmount)
  chk('S8', '客户金额分布(customerShareAmount)合计 = 全量金额',
    Math.abs(shareAmtSum - Number(s.amount || 0)) < 1, `合计=${shareAmtSum} / amount=${s.amount}`)

  console.log('')
  if (fails === 0) console.log('[PASS] 销售模块取数不变量全部满足')
  else { console.log(`[FAIL] ${fails} 项不符`); process.exit(1) }
}
main().catch((e) => { console.error('FATAL ' + e.message); process.exit(1) })
