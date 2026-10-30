/**
 * seed-mobile-pick-real-20261030.mjs — 走**真实流程**生成各环节测试数据
 *
 * 用户口径(2026-10-30 最终版):
 *   ① 「测试的工单要从工单结转转过来」;
 *   ② 「bom 生成的领料单明细 = bom 组成个数 × 工单需求数量」;
 *   ③ 「数据都用真实数据」。
 *
 * ────────────────────────────────────────────────────────────
 * ★ 两步走,产品清单是**同一份真源**
 * ────────────────────────────────────────────────────────────
 *   node ...mjs --plan       ① 拉真实待结转 → 选出 N 个产品 → 写 tools/archive/_real-seed/products.txt
 *   (跑 .sql 建 BOM,SQL 读同一份 products.txt)
 *   node ...mjs --run        ② 逐个产品:结转 → 排产 → 生单 → 领料 → 提交 → 退料
 *
 * 为什么必须这样:第一版 SQL 自己按**订单行**筛、mjs 自己按**产品聚合**筛,
 * 两边选出的产品只有 1 个交集 —— 建了 BOM 的产品没订单行,有订单行的没 BOM。
 *
 * ★ 工单行号不能假设是 1
 *   订单结转会把同一订单的多个行合并进一张工单(pl_no 相同、pl_xc 不同),
 *   必须从工单里查出真实行号(实测见到过 #1~#12)。
 */

import { request as httpRequest } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLAN_DIR = join(HERE, 'archive', '_real-seed')
const PLAN_FILE = join(PLAN_DIR, 'products.txt')

const BASE = process.env.YJ_BASE || 'http://127.0.0.1:8090'
const USER = process.env.YJ_USER || 'admin'
const PASS = process.env.YJ_PASS || '123456'
const FACTORY = process.env.YJ_FACTORY || 'YJ_TEST'
const PROD_LINE = process.env.YJ_LINE || '成型1线'
const HOW_MANY = Number(process.env.YJ_N || 40)
const MAX_QTY = Number(process.env.YJ_MAXQTY || 30000)

const MODE_PLAN = process.argv.includes('--plan')
const MODE_RUN = process.argv.includes('--run')

const STAGES = [
  { key: 'G1', label: '已开单未领', steps: ['create'] },
  { key: 'G2', label: '领了一部分', steps: ['create', 'pickOne'] },
  { key: 'G3', label: '已完成', steps: ['create', 'pickAll', 'submit'] },
  { key: 'G4', label: '已完成+已退料', steps: ['create', 'pickAll', 'submit', 'return'] },
]

function call(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body)
    const u = new URL(BASE + path)
    const req = httpRequest({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let json = null
        try { json = JSON.parse(text) } catch { /* 保留原文 */ }
        resolve({ status: res.statusCode, json, text })
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function must(r, what) {
  if (r.status >= 400 || (r.json && r.json.code !== 200)) {
    throw new Error(`${what} 失败: ${(r.json && r.json.message) || r.text || r.status}`)
  }
  return (r.json && r.json.data) || {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login() {
  return must(await call('POST', '/api/auth/login',
    { userName: USER, password: PASS, factory: FACTORY }), '登录').token
}

async function pendingRows(token) {
  const pend = must(await call('POST', '/api/px/orderConvert/pending', {}, token), '查待结转')
  return Array.isArray(pend) ? pend : (pend.rows || pend.list || [])
}

/** ① 选出产品清单(写入文件,Sql 与 --run 共用) */
async function plan() {
  const token = await login()
  const rows = await pendingRows(token)
  const agg = new Map()
  for (const r of rows) {
    const code = String(r.物料编码 || '').trim()
    const rest = Number(r.剩余数量) || 0
    if (!code || rest <= 0 || rest > MAX_QTY) continue
    if (!agg.has(code)) agg.set(code, { code, qty: 0, lines: 0 })
    const a = agg.get(code)
    a.qty += rest
    a.lines += 1
  }
  const list = [...agg.values()].sort((a, b) => a.qty - b.qty).slice(0, HOW_MANY)
  if (!existsSync(PLAN_DIR)) mkdirSync(PLAN_DIR, { recursive: true })
  writeFileSync(PLAN_FILE, list.map((x) => `${x.code}\t${x.qty}\t${x.lines}`).join('\n'), 'utf8')

  // 把同一份清单**写进 .sql**(替换占位区),保证 SQL 与 --run 用的是同一批产品。
  // 第一版让 SQL 自己按订单行筛,和这里的按产品聚合对不上,只有 1 个交集。
  try {
    const sqlPath = join(HERE, 'seed-mobile-pick-real-20261030.sql')
    if (existsSync(sqlPath)) {
      let sql = readFileSync(sqlPath, 'utf8')
      // ⚠ 必须用普通字符串拼接,不要用模板字符串:
      //   本文件曾被 PowerShell 双引号展开改坏过一次,模板里的 ${x.code} 被当成变量求值成空,
      //   结果 SQL 里写进去一排 (N''),建 BOM 时全部指向空产品。
      const vals = list.map((x) => "  (N'" + x.code + "')").join(',\n')
      const patched = sql.replace(/\(N'__PLACEHOLDER__'\)|\n  \(N'[^']*'\)(?:,\n  \(N'[^']*'\))*;/, vals + ';')
      if (patched !== sql) {
        writeFileSync(sqlPath, patched, 'utf8')
        console.log('       已同步写入 SQL 的产品清单区')
      } else {
        console.log('       ⚠ SQL 里没找到清单占位区,请手工核对')
      }
    }
  } catch (e) {
    console.log('       ⚠ 写 SQL 清单失败: ' + e.message)
  }
  console.log(`[计划] 选出 ${list.length} 个产品 → ${PLAN_FILE}`)
  console.log(`       订单行合计 ${list.reduce((s, x) => s + x.lines, 0)} 条`)
  for (const x of list.slice(0, 8)) console.log(`       ${x.code}  剩余 ${x.qty}  行数 ${x.lines}`)
  console.log('       下一步:跑 seed-mobile-pick-real-20261030.sql 建 BOM,再 --run')
}

function readPlan() {
  if (!existsSync(PLAN_FILE)) throw new Error(`缺少产品清单 ${PLAN_FILE},请先跑 --plan`)
  return readFileSync(PLAN_FILE, 'utf8').split(/\r?\n/)
    .map((l) => l.split('\t')[0].trim()).filter(Boolean)
}

/** ② 推各个环节 */
async function run() {
  const products = readPlan()
  console.log(`[目标] ${BASE}  工厂=${FACTORY}  产线=${PROD_LINE}`)
  console.log(`[清单] ${products.length} 个产品(来自 ${PLAN_FILE})`)
  const token = await login()

  const rows = await pendingRows(token)
  /**
   * 订单行池。
   *
   * 🔴 关键:每条订单行**只能转一次全量**,但 4 个环节要 4 张工单。
   *   订单结转支持「生单数量 < 剩余数量」分次转 ⇒ 把每条订单行**拆成 4 份**,
   *   每环节用一份。这样才能用有限的真实订单铺满 4 个环节,而不是第一节就把额度用光。
   *   (实测:只按整条转 ⇒ 42 条订单行只够 G1 的 40 张,G2~G4 全跳过。)
   */
  const SPLIT = STAGES.length
  const poolByCode = new Map()
  for (const r of rows) {
    const code = String(r.物料编码 || '').trim()
    if (!products.includes(code)) continue
    const rest = Number(r.剩余数量) || 0
    if (rest <= 0 || rest > MAX_QTY) continue
    if (!poolByCode.has(code)) poolByCode.set(code, [])
    const part = rest / SPLIT
    for (let k = 0; k < SPLIT; k++) {
      poolByCode.get(code).push({ row: r, rest: Math.max(0.0001, Math.round(part * 10000) / 10000) })
    }
  }
  for (const arr of poolByCode.values()) arr.sort((a, b) => a.rest - b.rest)
  const total = [...poolByCode.values()].reduce((s, a) => s + a.length, 0)
  console.log(`[池] 可用工单名额 ${total} 个(每条订单行拆 ${SPLIT} 份),覆盖 ${poolByCode.size}/${products.length} 个产品`)

  const stat = { ok: 0, fail: 0 }
  for (const stage of STAGES) {
    console.log(`\n══ ${stage.key} · ${stage.label} ═══`)
    for (const code of products) {
      const slot = (poolByCode.get(code) || []).shift()
      if (!slot) { console.log(`  - ${stage.key}/${code} 无剩余订单行,跳过`); continue }
      const tag = `${stage.key}/${code}`
      try {
        // ① 订单结转 → 转工单
        const conv = must(await call('POST', '/api/px/orderConvert/toManu', {
          rows: [{
            订单号: slot.row.订单号,
            行id: slot.row.行id,
            生单数量: String(slot.rest),
            工艺路线: 'GY-CB-STD',
          }],
        }, token), '转工单')
        const created = conv.编号清单 || conv.创建 || conv.created || conv.成功 || []
        if (!created.length) throw new Error((conv.失败行 && conv.失败行[0]) || '未返回工单号')
        const woNo = typeof created[0] === 'string' ? created[0]
          : String(created[0].工单号 || created[0].单号 || created[0])
        if (!woNo) throw new Error('未返回工单号')

        // ② 查真实工单行号(结转会把多行并进一张工单,行号不一定是 1)
        const st = must(await call('GET',
          `/api/px/mobilePick/create/woStatus?keyword=${encodeURIComponent(woNo)}`, null, token), '查工单行')
        const mine = (st.list || []).find((w) => String(w.工单号) === woNo && String(w.产品编号) === code)
        if (!mine) throw new Error(`工单 ${woNo} 里找不到产品 ${code} 的行`)
        const line = Number(mine.工单行号)

        // ③ 排产
        must(await call('POST', '/api/px/scheduleBoard/assign', {
          rows: [{ 加工单号: woNo, 生产线: PROD_LINE }],
        }, token), '排产')

        // ④ 生单(明细数量 = BOM 单件用量 × 工单数量)
        const gen = must(await call('POST', '/api/px/mobilePick/create/batch',
          { items: [{ woNo, line }], 打印: false }, token), '生单')
        if (!gen.成功 || !gen.成功.length) {
          throw new Error((gen.失败 && gen.失败[0] && gen.失败[0].原因) || '生单失败')
        }
        const id = gen.成功[0].id
        const doc = must(await call('GET', `/api/px/mobilePick/doc?id=${id}`, null, token), '读明细')
        const lines = doc.领料明细 || []
        if (!lines.length) throw new Error('明细为空')

        // ⑤ 领料
        // ⚠ 生单时已按「用量×工单数量」把**每一行都填满**了(用户口径「生成时就填好」),
        //   所以 G2 不能靠"选哪些行去领"来制造 —— 要反过来:先把第 2 行起清 0,
        //   只留第 1 行有数量 ⇒ 进度 1/N(真正的"领了一部分")。
        if (stage.steps.includes('pickAll') || stage.steps.includes('pickOne')) {
          const isOne = stage.steps.includes('pickOne')
          if (isOne) {
            for (const ln of lines.slice(1)) {
              await call('POST', '/api/px/mobilePick/setQty',
                { id, side: 'pick', code: String(ln.编码), qty: 0, batches: [] }, token)
            }
          }
          const targets = isOne ? [lines[0]] : lines
          for (const ln of targets) {
            const c = String(ln.编码)
            const sc = must(await call('POST', '/api/px/mobilePick/scanMaterial',
              { id, code: c, side: 'pick' }, token), '扫料 ' + c)
            const want = Number(sc.BOM用量) > 0 ? Number(sc.BOM用量) : Number(ln.数量) || 0
            const qty = Math.min(want, Number(sc.允许上限) || 0)
            if (qty <= 0) throw new Error('物料 ' + c + ' 可用量 0')
            must(await call('POST', '/api/px/mobilePick/setQty', {
              id, side: 'pick', code: c, qty,
              batches: (sc.批次 || []).length
                ? [{ 批号: sc.批次[0].批号, 仓库: sc.批次[0].仓库, 仓库编码: sc.批次[0].仓库编码, 数量: qty }]
                : [],
            }, token), '写数量 ' + c)
          }
        }


        // ⑥ 提交
        if (stage.steps.includes('submit')) {
          must(await call('POST', '/api/px/mobilePick/submit', { id }, token), '提交')
        }

        // ⑦ 退料(退第一项的一半)
        if (stage.steps.includes('return')) {
          const c = String(lines[0].编码)
          const rs = must(await call('POST', '/api/px/mobilePick/returnScan',
            { id, code: c }, token), '查可退')
          const can = Number(rs.可退数量) || 0
          if (can > 0) {
            const q = Math.max(0.0001, Math.round((can / 2) * 10000) / 10000)
            must(await call('POST', '/api/px/mobilePick/submitReturn',
              { id, items: [{ code: c, qty: q }] }, token), '退料')
          }
        }

        stat.ok++
        console.log(`  ✓ ${tag}  工单 ${woNo}#${line}  明细 ${lines.length} 项`)
        await sleep(150)
      } catch (e) {
        stat.fail++
        console.log(`  ✗ ${tag}: ${e.message}`)
      }
    }
  }
  console.log(`\n[完成] 成功 ${stat.ok} / 失败 ${stat.fail}`)
}

if (MODE_PLAN) {
  plan().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
} else if (MODE_RUN) {
  run().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
} else {
  console.log('用法:')
  console.log('  node tools/seed-mobile-pick-real-20261030.mjs --plan   选出产品清单')
  console.log('  跑 tools/seed-mobile-pick-real-20261030.sql 建 BOM')
  console.log('  node tools/seed-mobile-pick-real-20261030.mjs --run    推各环节')
}
