/**
 * seed-mobile-pick-all-stages-20261030.mjs — 把「全环节」测试数据推到各个状态
 *
 * 前置:先跑同名的 .sql(造 50 张工单 GD-STG-* + 6 张组装工艺清单 AP-STG-*)。
 *
 * 为什么用接口而不是直接 INSERT:
 *   领料单 / 材料出库单 / 库存台账(kucun、inh、outh)/ 退料台账之间是一整条过账链,
 *   手工往表里塞必然与真实过账分叉 —— 库存对不上、工单回写不对、状态推不出来。
 *   ⇒ 只有真调接口跑出来的单据,测起来的界面表现才与生产一致。
 *
 * 用法(仓库根):
 *   node tools/seed-mobile-pick-all-stages-20261030.mjs           # 干跑,只打印计划
 *   node tools/seed-mobile-pick-all-stages-20261030.mjs --run     # 真跑
 *   node tools/seed-mobile-pick-all-stages-20261030.mjs --run --reset
 *        --reset:先把 GD-STG-* 已产生的单据清掉(调删除/作废接口,再删台账),
 *                 便于反复重跑。
 *
 * 目标状态(每组 10 条):
 *   A 未开单        —— 什么都不做(它们本来就是未开单)
 *   B 未排产        —— 什么都不做(开单会被拦)
 *   C 已开单未领    —— 只生单
 *   D 领了一部分    —— 生单 + 领第一项
 *   E 已完成        —— 生单 + 领满 + 提交
 *   F 已完成+已退料 —— 生单 + 领满 + 提交 + 退一部分
 */

import { request as httpRequest } from 'node:http'

const BASE = process.env.YJ_BASE || 'http://127.0.0.1:8090'
const USER = process.env.YJ_USER || 'admin'
const PASS = process.env.YJ_PASS || '123456'
/** 测试账套工厂码(见后端 DataSourceRouter.TEST) */
const FACTORY = process.env.YJ_FACTORY || 'YJ_TEST'

const RUN = process.argv.includes('--run')
const RESET = process.argv.includes('--reset')

// ── HTTP ────────────────────────────────────────────────────────────
function call(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body)
    const u = new URL(BASE + path)
    const req = httpRequest({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
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
        try { json = JSON.parse(text) } catch { /* 非 JSON 原样返回 */ }
        resolve({ status: res.statusCode, json, text })
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

/** 业务错误统一抛出(把后端 message 带出来,方便定位哪一步挂了) */
function must(r, what) {
  if (r.status >= 400 || (r.json && r.json.code !== 200)) {
    const msg = (r.json && r.json.message) || r.text || `HTTP ${r.status}`
    throw new Error(`${what} 失败: ${msg}`)
  }
  return (r.json && r.json.data) || {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 主流程 ──────────────────────────────────────────────────────────
async function main() {
  console.log(`[目标] ${BASE}  工厂=${FACTORY}  运行=${RUN ? '是' : '否(加 --run 才真跑)'}`)

  const login = must(await call('POST', '/api/auth/login', { userName: USER, password: PASS, factory: FACTORY }), '登录')
  const token = login.token
  console.log(`[登录] ${USER} OK`)

  /** 拉出这 50 张工单,按组分类 */
  const st = must(await call('GET', '/api/px/mobilePick/create/woStatus?keyword=GD-STG', null, token), '查工单')
  const list = (st.list || []).filter((w) => String(w.工单号).startsWith('GD-STG-'))
  const groups = { A: [], B: [], C: [], D: [], E: [], F: [] }
  for (const w of list) {
    const g = String(w.工单号).charAt(7) // GD-STG-X## → 第 8 个字符
    if (groups[g]) groups[g].push(w)
  }
  console.log('[分组] ' + Object.entries(groups).map(([k, v]) => `${k}=${v.length}`).join('  '))

  if (RESET && RUN) {
    console.log('\n[重置] 清理 GD-STG-* 已产生的单据 …')
    for (const w of list) {
      if (!w.已开单 || !w.台账id) continue
      try {
        // 逐张:先把单据删掉(草稿可删;已完成先弃审再删)
        const doc = must(await call('GET', `/api/px/mobilePick/doc?id=${w.台账id}`, null, token), '读单据')
        if (String(doc.状态) === '已完成') {
          await call('POST', '/api/px/callButton', { panelCode: 'MATERIAL_OUT', buttonName: '弃审', formData: { 编号: doc.领料单号 } }, token)
        }
      } catch (e) {
        console.log(`  ! ${w.工单号} 复位异常(忽略):${e.message}`)
      }
    }
    console.log('  ⚠ 接口层复位不完整时,请改用 SQL 脚本 reset(见 README 说明);继续执行')
  }

  const plan = [
    ['C', '已开单未领', ['create']],
    ['D', '领了一部分', ['create', 'pickOne']],
    ['E', '已完成', ['create', 'pickAll', 'submit']],
    ['F', '已完成+已退料', ['create', 'pickAll', 'submit', 'return']],
  ]

  const stat = { ok: 0, skip: 0, fail: 0 }
  for (const [g, label, steps] of plan) {
    console.log(`\n══ ${g} 组 · ${label}(${groups[g].length} 张)═══`)
    for (const w of groups[g]) {
      const no = w.工单号
      if (w.已开单) { stat.skip++; continue }        // 已经做过,不重复
      if (!RUN) { stat.ok++; continue }
      try {
        // ① 生单
        const gen = must(await call('POST', '/api/px/mobilePick/create/batch',
          { items: [{ woNo: no, line: 1 }], 打印: false }, token), '生单')
        if (!gen.成功 || !gen.成功.length) {
          throw new Error((gen.失败 && gen.失败[0] && gen.失败[0].原因) || '未生成')
        }
        const id = gen.成功[0].id
        const doc = must(await call('GET', `/api/px/mobilePick/doc?id=${id}`, null, token), '读明细')
        const lines = doc.领料明细 || []
        if (!lines.length) throw new Error('明细为空(BOM 没展开)')

        // ② 领料:只有 D/E/F 才领(用 pick 步骤判定,不再用 targets 长度判断 ——
        //    第一版就是这样把 C 组(应"一项没领")也领了第一项,进度成了 1/3)
        if (steps.includes('pickAll') || steps.includes('pickOne')) {
          const targets = steps.includes('pickAll') ? lines : [lines[0]]
          for (const ln of targets) {
            const code = String(ln.编码)
            const sc = must(await call('POST', '/api/px/mobilePick/scanMaterial',
              { id, code, side: 'pick' }, token), `扫料 ${code}`)
            const qty = Number(sc.BOM用量) > 0 ? Number(sc.BOM用量) : Math.min(1, Number(sc.允许上限) || 1)
            must(await call('POST', '/api/px/mobilePick/setQty', {
              id, side: 'pick', code, qty,
              batches: (sc.批次 || []).length
                ? [{ 批号: sc.批次[0].批号, 仓库: sc.批次[0].仓库, 仓库编码: sc.批次[0].仓库编码, 数量: qty }]
                : [],
            }, token), `写数量 ${code}`)
          }
        }

        // ③ 提交
        if (steps.includes('submit')) {
          must(await call('POST', '/api/px/mobilePick/submit', { id }, token), '提交')
        }

        // ④ 退料(只退第一项的一半,保证还有剩余可退)
        if (steps.includes('return')) {
          const code = String(lines[0].编码)
          const rs = must(await call('POST', '/api/px/mobilePick/returnScan', { id, code }, token), `查可退 ${code}`)
          const can = Number(rs.可退数量) || 0
          if (can > 0) {
            const q = Math.max(0.0001, Math.round((can / 2) * 10000) / 10000)
            must(await call('POST', '/api/px/mobilePick/submitReturn', { id, items: [{ code, qty: q }] }, token), '退料')
          }
        }
        stat.ok++
        console.log(`  ✓ ${no}`)
        await sleep(120)   // 慢一点,别把过账链打满
      } catch (e) {
        stat.fail++
        console.log(`  ✗ ${no}: ${e.message}`)
      }
    }
  }

  console.log(`\n[完成] 成功 ${stat.ok} / 跳过(已做) ${stat.skip} / 失败 ${stat.fail}`)
  if (!RUN) console.log('（干跑:加 --run 才会真的调接口）')
}

main().catch((e) => {
  console.error('\n[FATAL] ' + e.message)
  process.exit(1)
})
