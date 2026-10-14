/**
 * 只读探针(2026-10-14):查**金蝶真实账套**有没有「生产工单/生产任务单」数据,以及字段形态。
 *
 * 背景:用户要拉金蝶账套的生产工单数据。仓库里现有:
 *   · deploy/config.json        → 金蝶**真实账套**(clientId=359797 + outerInstanceId)★ 本探针用它
 *   · deploy/push/config.json   → **测试沙箱**(clientId=359220)  ← 旧探针多用这份,别搞混
 *   · deploy/doc-endpoints.json → 应用已登记的 40 个端点,其中生产相关的只有:
 *       /jdy/v2/pm/mo_taskbill    生产任务单列表
 *       /jdy/v2/pm/subm_workorder 委外加工单列表
 *       /jdy/v2/scm/inv_pick      生产领料单列表
 *       /jdy/v2/scm/inv_product   产品入库单列表
 *     ——「生产工单」在星辰里叫什么路径**不能靠猜**(猜错的表现是 errcode!=0 或空列表),
 *        故本探针逐个试,并打印实际字段。
 *
 * 本探针**只读**(全部 GET),不写任何单据。
 * 用法:  node tools/archive/_probe-kingdee-mo-taskbill-1014.mjs
 * 产物:  tools/archive/_probe-kingdee-mo-taskbill-1014.out.txt(UTF-8,完整字段与样例行)
 */
import { writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfgPath = new URL('../../deploy/config.json', import.meta.url)
const cfgAll = JSON.parse((await import('node:fs')).readFileSync(cfgPath, 'utf8'))
const cfg = cfgAll.kingdee
const out = []
const say = (s) => { out.push(s); console.log(s) }

say('=== 金蝶真实账套探针(生产工单/生产任务单)===')
say(`账套: clientId=${cfg.clientId} outerInstanceId=${cfg.outerInstanceId} domain=${cfg.domain}`)
say(`时间: ${new Date().toISOString()}`)

const { token } = await fetchAppToken(cfg)
say(`✅ app-token 已获取(长度 ${token.length})`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const j = (v) => JSON.stringify(v)

// ── ① 候选路径存在性 ───────────────────────────────────────────────
say('\n=== ① 候选路径探测(page=1,page_size=2)===' )
const candidates = [
  '/jdy/v2/pm/mo_taskbill',        // 已登记:生产任务单列表
  '/jdy/v2/pm/mo_taskbill_detail', // 详情(若存在)
  '/jdy/v2/pm/mo_bill',            // 猜测:生产工单
  '/jdy/v2/pm/mo_bill_detail',
  '/jdy/v2/pm/subm_workorder',     // 已登记:委外加工单
  '/jdy/v2/scm/inv_pick',          // 已登记:生产领料单(生产链下游,作对照)
  '/jdy/v2/scm/inv_product',       // 已登记:产品入库单(生产链下游,作对照)
]
const probe = {}
for (const p of candidates) {
  const r = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '2' })
  probe[p] = r
  say(r.ok ? `✅ ${p} → count=${r.data?.count}` : `❌ ${p} → ${String(r.error).slice(0, 140)}`)
  await sleep(250)
}

// ── ② 生产任务单:列表字段 + 一条样例 ──────────────────────────────
say('\n=== ② 生产任务单 /jdy/v2/pm/mo_taskbill ===')
const list = await kingdeeTryGet(cfg, token, '/jdy/v2/pm/mo_taskbill', { page: '1', page_size: '50' })
if (list.ok) {
  const d = list.data || {}
  say(`总数 count = ${d.count}`)
  const rows = d.rows || []
  say(`本页行数 = ${rows.length}`)
  if (rows[0]) {
    say(`列表行字段(${Object.keys(rows[0]).length} 个): ${Object.keys(rows[0]).join(', ')}`)
    say(`\n--- 样例(第 1 行,完整 JSON)---\n${JSON.stringify(rows[0], null, 1)}`)
    // 单号清单(给「与本地对应」比对用)
    say(`\n--- 本页单号清单(前 50)---`)
    for (const r of rows) {
      say(`  ${r.bill_no}\t${r.bill_date || r.date || ''}\t${r.status || ''}\t${r.material_number || r.material_name || ''}`)
    }
    // 详情
    const id = rows[0].id
    const det = await kingdeeTryGet(cfg, token, '/jdy/v2/pm/mo_taskbill_detail', { id: String(id) })
    say(`\n--- 详情 /mo_taskbill_detail?id=${id} ---`)
    if (det.ok) {
      const dd = det.data || {}
      say(`顶层键: ${Object.keys(dd).join(', ')}`)
      for (const k of ['material_entity', 'bill_entry', 'entry', 'mo_entry', 'details']) {
        if (Array.isArray(dd[k])) {
          say(`分录键名 = ${k},行数 = ${dd[k].length}`)
          if (dd[k][0]) say(`分录字段: ${Object.keys(dd[k][0]).join(', ')}\n首条分录: ${JSON.stringify(dd[k][0], null, 1)}`)
          break
        }
      }
    } else {
      say(`❌ 详情失败: ${String(det.error).slice(0, 200)}`)
    }
  } else {
    say('(账套内该列表为空 —— 无生产任务单数据)')
  }
} else {
  say(`❌ 列表失败: ${String(list.error).slice(0, 200)}`)
}

// ── ③ 委外加工单 / 生产领料单 / 产品入库单:只要数量(旁证生产链是否有数据)──
say('\n=== ③ 生产链其它单据数量(旁证)===')
for (const p of ['/jdy/v2/pm/subm_workorder', '/jdy/v2/scm/inv_pick', '/jdy/v2/scm/inv_product']) {
  const r = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '1' })
  say(r.ok ? `  ${p} → count=${r.data?.count}` : `  ${p} → ❌ ${String(r.error).slice(0, 120)}`)
  await sleep(250)
}

const outFile = new URL('./_probe-kingdee-mo-taskbill-1014.out.txt', import.meta.url)
writeFileSync(outFile, out.join('\n') + '\n', 'utf8')
console.log(`\n[产物已落盘] tools/archive/_probe-kingdee-mo-taskbill-1014.out.txt`)
