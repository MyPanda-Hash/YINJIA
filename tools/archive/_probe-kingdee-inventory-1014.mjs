/**
 * 期初结存探针(2026-10-14):找金蝶「库存查询/现存量」接口,确认返回维度(商品/仓库/批号)与分页。
 *
 * 为什么需要:用户口径「先导期初结存,再记账」—— 期初必须能落到 MES kucun 的三键
 *   (wzdm=商品编码 / ckdm=仓库编码 / lot_no=批号),否则记账后对不上。
 *
 * 只读。用法: node tools/archive/_probe-kingdee-inventory-1014.mjs
 * 产物: tools/archive/_dump-out/kingdee-inventory-probe-1014.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CANDIDATES = [
  ['/jdy/v2/inv/inv_inventory_ims', '库存查询(IMS)'],
  ['/jdy/v2/scm/inventory', '库存查询(scm)'],
  ['/jdy/v2/inv/inventory', '库存查询(inv)'],
  ['/jdy/v2/scm/inv_inventory', '库存(inv_inventory)'],
  ['/jdy/v2/inv/inv_inventory', '库存(inv_inv_inventory)'],
  ['/jdy/v2/scm/inventory_ims', '库存(ims)'],
  ['/jdy/v2/scm/inv_stock', '库存(inv_stock)'],
  ['/jdy/v2/bd/inv_inventory', '库存(bd)'],
]

const out = []
const say = (s) => { out.push(s); console.log(s) }
say('# 金蝶「现存量/库存查询」接口探针')
say('')
say(`- 账套:惠州市银嘉环保(只读)  时间:${new Date().toISOString()}`)
say('')

const found = []
for (const [path, label] of CANDIDATES) {
  const r = await kingdeeTryGet(cfg, token, path, { page: '1', page_size: '3' })
  if (r.ok) {
    const d = r.data || {}
    const rows = d.rows || d.list || []
    const keys = rows[0] ? Object.keys(rows[0]) : []
    say(`## ✅ ${label} \`${path}\``)
    say('')
    say(`- count = ${d.count ?? '(无)'};首页返回 ${rows.length} 行`)
    say(`- 列(${keys.length}):${keys.slice(0, 60).join(', ')}`)
    if (rows[0]) {
      say('')
      say('```json')
      say(JSON.stringify(rows[0], null, 1).slice(0, 1800))
      say('```')
    }
    say('')
    found.push({ path, label, count: d.count, keys })
  } else {
    say(`- ❌ ${label} \`${path}\` → ${String(r.error).slice(0, 90)}`)
  }
  await sleep(250)
}

say('')
say('## 结论')
say('')
if (!found.length) say('- ❌ 8 个候选路径全部不可用,需要另找接口(或走「库存台账/收发存汇总」报表接口)')
else {
  say(`- 可用接口 ${found.length} 个,首选 **\`${found[0].path}\`**(count=${found[0].count})`)
  const k = found[0].keys
  const has = (n) => k.some((x) => x.includes(n))
  say(`- 维度自检(首选的列名里):商品=${has('material') ? '✅' : '❌'} 仓库=${has('stock') ? '✅' : '❌'} 批号=${has('batch') ? '✅' : '❌'} 数量=${has('qty') ? '✅' : '❌'}`)
}

mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/kingdee-inventory-probe-1014.md', import.meta.url), out.join('\n'), 'utf8')
console.log('\n[产物] tools/archive/_dump-out/kingdee-inventory-probe-1014.md')
