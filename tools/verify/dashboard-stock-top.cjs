/**
 * 验证:「我的桌面 → 库存 → 现存量 TOP 物料」卡片已改绑库存状况表。
 *
 * 背景:旧口径按 wzdm 物料代码分组读 kucun(结存缓存表,写入者标记 kucun-resync),
 * 卡片显示的是代码,数据也不随出入库实时变。
 * 新口径读实时聚合视图 v_stock_balance(库存状况表 STOCK_BALANCE 的底表)。
 * 2026-10-10:卡片改为滚动全量展示,后端取消 TOP 8 截断,故断言由「长度 = 8」改为「未截断」。
 *
 * 断言:
 *   1. /api/dashboard/stats 返回 stock.topItems,非空且未按 TOP 8 截断
 *   2. 每项 name 是物料名称(不是形如 M-025 的物料代码),meta 是该物料的存货编码
 *      —— 物料名本身即代码时(如 CL004,name === meta)不算违规,属数据真实值
 *   3. name 与 meta 一一对应,无重复
 *   4. value 降序
 *   5. value 为数值(非字符串),且全为正(现存量 0/负的行不应进 TOP)
 *
 * 用法: node tools/verify/dashboard-stock-top.cjs
 */
const BASE = 'http://127.0.0.1:8090'

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

/** 物料代码形如 M-025 / T382 / CL004(字母+可选短横线+数字),纯代码不含中文 */
const CODE_LIKE = /^[A-Za-z]{1,4}-?\d{2,6}$/

async function main() {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const lj = await lr.json()
  if (!lj.data || !lj.data.token) throw new Error('登录失败: ' + JSON.stringify(lj))
  const H = { Authorization: 'Bearer ' + lj.data.token }

  const sr = await fetch(`${BASE}/api/dashboard/stats`, { headers: H })
  const sj = await sr.json()
  const items = sj?.data?.stock?.topItems
  if (!Array.isArray(items)) throw new Error('stock.topItems 不是数组: ' + JSON.stringify(sj?.data?.stock))

  console.log('\n实测 TOP 物料:')
  items.forEach((it) => console.log(`  ${it.name}  ${it.value}  [${it.meta ?? '-'}]`))
  console.log('')

  check('topItems 未按 TOP 8 截断', items.length > 8, `实际 ${items.length} 项`)

  // 物料名与编码同名时(如 CL004)不判违规:那是数据真实值,不是口径回退成代码
  const codeNames = items.filter((it) => String(it.name) !== String(it.meta) && CODE_LIKE.test(String(it.name)))
  check(
    'name 是物料名称而非物料代码',
    codeNames.length === 0,
    codeNames.length ? `仍是代码: ${codeNames.map((c) => c.name).join(', ')}` : '全部为名称(同名物料已豁免)'
  )

  const noMeta = items.filter((it) => !it.meta)
  check(
    '每项都带 meta(存货编码)',
    noMeta.length === 0,
    noMeta.length ? `缺 meta: ${noMeta.map((c) => c.name).join(', ')}` : items.map((i) => i.meta).join(' / ')
  )

  const metas = items.map((it) => it.meta)
  check('meta 无重复', new Set(metas).size === metas.length, metas.join(' / '))

  const vals = items.map((it) => it.value)
  const nonNum = vals.filter((v) => typeof v !== 'number')
  check('value 为数值', nonNum.length === 0, nonNum.length ? `非数值: ${nonNum.join(', ')}` : vals.join(' / '))

  const pos = vals.filter((v) => !(v > 0))
  check('value 全为正(现存量>0)', pos.length === 0, pos.length ? `非正: ${pos.join(', ')}` : '')

  const desc = vals.every((v, i) => i === 0 || vals[i - 1] >= v)
  check('value 降序', desc, vals.join(' >= '))

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} PASS`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('探针异常: ' + (e && e.message ? e.message : e))
  process.exit(2)
})
