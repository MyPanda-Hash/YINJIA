/**
 * 只读探针(2026-10-15):确定销售出库单挂「源销售订单」要用的**金蝶接口与字段名**。
 *
 * 为什么必须先探:采购侧挂源单写的是 src_bill_no/src_bill_type_id/src_inter_id/src_seq/src_entry_id
 *   (常量 pur_bill_order),那是**采购订单**的类型常量。销售订单的类型常量是什么、
 *   列表/详情接口路径叫什么,仓库里没有留档(本地 SO_ORDER-*.jsonl 是 MES 侧镜像,不是金蝶 API schema),
 *   **不能靠猜** —— 猜错的表现是金蝶静默忽略引用(落库后 src_bill_no 为空)或整单被拒。
 *
 * 本探针**只读**(GET),不写任何单据。用法:
 *   node tools/archive/_probe-kingdee-sal-src-1015.mjs
 */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8'))
console.log('目标账套:', cfg.kingdee.outerInstanceId ? '真实账套' : '测试沙箱')
console.log('domain:', cfg.kingdee.domain, '\n')

const { token } = await fetchAppToken(cfg.kingdee)
console.log('✅ token 长度', token.length, '\n')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ① 销售订单列表/详情接口是否存在(采购侧对应 pur_order / pur_order_detail)
console.log('=== ① 销售订单接口探测 ===')
const paths = [
  '/jdy/v2/scm/sal_order',
  '/jdy/v2/scm/sal_order_detail',
  '/jdy/v2/scm/sal_out_bound',
  '/jdy/v2/scm/sal_out_bound_detail',
  '/jdy/v2/scm/pur_order',          // 对照组:采购侧已知可用
  '/jdy/v2/scm/pur_order_detail',
]
for (const p of paths) {
  const r = await kingdeeTryGet(cfg.kingdee, token, p, { page: '1', page_size: '2' })
  console.log(r.ok ? `✅ ${p} → count=${r.data?.count}` : `❌ ${p} → ${String(r.error).slice(0, 120)}`)
  await sleep(200)
}

// ② 若销售订单接口可用,取一条真实订单看 list 行里的 id 与 bill_no 字段名
console.log('\n=== ② 销售订单列表行字段(取 1 条)===')
try {
  const r = await kingdeeTryGet(cfg.kingdee, token, '/jdy/v2/scm/sal_order', { page: '1', page_size: '1' })
  if (r.ok) {
    const row = (r.data?.rows || [])[0]
    if (row) {
      console.log('list 行键:', Object.keys(row).slice(0, 40).join(', '))
      console.log('bill_no =', row.bill_no, '| id =', row.id)
      // 详情:分录结构(找 seq / id)
      const d = await kingdeeTryGet(cfg.kingdee, token, '/jdy/v2/scm/sal_order_detail', { id: String(row.id) })
      if (d.ok) {
        const ents = d.data?.material_entity || d.data?.bill_entry || []
        console.log('detail 顶层键:', Object.keys(d.data || {}).slice(0, 30).join(', '))
        console.log('分录数 =', Array.isArray(ents) ? ents.length : '(非数组)')
        if (Array.isArray(ents) && ents[0]) console.log('分录键:', Object.keys(ents[0]).slice(0, 30).join(', '))
      } else {
        console.log('❌ 详情失败:', String(d.error).slice(0, 160))
      }
    } else {
      console.log('(无行)')
    }
  } else {
    console.log('❌ 列表失败:', String(r.error).slice(0, 160))
  }
} catch (e) {
  console.log('异常:', e.message)
}

// ③ 销售出库单详情:看它**实际已有的** src_* 字段(同族对照,判断金蝶 sal_out_bound 收哪些键)
console.log('\n=== ③ 销售出库单列表/详情(看已有 src_* 键名)===')
try {
  const r = await kingdeeTryGet(cfg.kingdee, token, '/jdy/v2/scm/sal_out_bound', { page: '1', page_size: '2' })
  if (r.ok) {
    const rows = r.data?.rows || []
    console.log('count =', r.data?.count, '| 取样', rows.length, '条')
    if (rows[0]) {
      console.log('list 行键:', Object.keys(rows[0]).slice(0, 40).join(', '))
      const d = await kingdeeTryGet(cfg.kingdee, token, '/jdy/v2/scm/sal_out_bound_detail', { id: String(rows[0].id) })
      if (d.ok) {
        const ents = d.data?.material_entity || d.data?.bill_entry || []
        if (Array.isArray(ents) && ents[0]) {
          console.log('单据头键:', Object.keys(d.data).slice(0, 40).join(', '))
          console.log('分录键  :', Object.keys(ents[0]).join(', '))
        }
      } else {
        console.log('❌ 出库单详情失败:', String(d.error).slice(0, 160))
      }
    }
  } else {
    console.log('❌ 出库单列表失败:', String(r.error).slice(0, 160))
  }
} catch (e) {
  console.log('异常:', e.message)
}

process.exit(0)
