#!/usr/bin/env node
/**
 * _verify-api.mjs —— 生产工单追溯「完工数据」段 **工序口径计划数量 + 换算率 + 待审数量** 修复的接口取证(2026-11-15)。
 *
 * 被验证的修复(源码,勿改):
 *   backend/src/main/java/com/yinjia/mes/service/ScheduleBoardService.java  #trace / #fillDonePlanQty
 *     ① 完工数据.计划数量 = **本行排产数量 × 该道换算率**(工序口径,不再取 MAX(scjl.pl_sl) 成品口径;
 *        整单口径逐行算完再累加);
 *     ② 新增 `换算率` 字段(各道路线率一致才回填,否则空串);
 *     ③ 完成数量 **只算已审**(wgzt='Y'),新增 `待审数量`(草稿),`单据状态` 三态(含草稿/已审核/草稿);
 *   backend/src/main/java/com/yinjia/mes/service/ProcessTaskService.java  #stepsSummary
 *     ④ 产出/未完成/进度 折成品(末道完工量 ÷ 该道换算率)后再与 计划合计 比。
 *
 * 用法(仓库根目录):
 *   node tools/archive/_wo-trace-qty-20261115/_verify-api.mjs
 *   node tools/archive/_wo-trace-qty-20261115/_verify-api.mjs --no-8090        # 跳过老 jar 对照
 *   node tools/archive/_wo-trace-qty-20261115/_verify-api.mjs --base=http://127.0.0.1:8091/api
 *
 * 输出:控制台 + 同目录 `_verify-api.out.txt`(可复跑取证)。
 *
 * 断言口径(Lead 2026-11-15 订正):**计划数量 / 换算率** 是修复核心,稳定,硬断言;
 * `完成数量/待审数量/单据状态` 仅在**已审/无草稿**的样本上硬断言,现场正在录报工的样本只记录;
 * `processTask/detail` 的 产出/进度 对 3209(现场在录)按 **soft** 处理(只告警不判 FAIL)。
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '_verify-api.out.txt')

const argv = process.argv.slice(2)
const argOf = (n) => {
  const p = argv.find((a) => a.startsWith('--' + n + '='))
  return p ? p.slice(n.length + 3) : null
}
const BASE_NEW = (argOf('base') || 'http://127.0.0.1:8091/api').replace(/\/$/, '')
const WITH_8090 = !argv.includes('--no-8090')
const BASE_OLD = (argOf('base-old') || 'http://127.0.0.1:8090/api').replace(/\/$/, '')

const lines = []
const log = (s = '') => { lines.push(s); console.log(s) }

let pass = 0
let fail = 0
let warn = 0
let cur = []

/** 数字/百分比宽松转换:25 / "25" / "100%" → 数字 */
const numOf = (v) => {
  if (v == null) return NaN
  if (typeof v === 'number') return v
  const s = String(v).trim().replace(/%$/, '')
  return s === '' ? NaN : Number(s)
}

function check(label, actual, expected) {
  const ok = typeof expected === 'string'
    ? String(actual ?? '') === expected
    : Math.abs(numOf(actual) - Number(expected)) < 1e-6
  if (ok) { pass++; cur.push(`    [PASS] ${label} = ${JSON.stringify(actual)}`) }
  else { fail++; cur.push(`    [FAIL] ${label} = ${JSON.stringify(actual)}  (期望 ${JSON.stringify(expected)})`) }
  return ok
}

/** 现场数据在填的样本:只告警,不计入 FAIL(但仍打印实际值) */
function soft(label, actual, expected) {
  const ok = typeof expected === 'string'
    ? String(actual ?? '') === expected
    : Math.abs(numOf(actual) - Number(expected)) < 1e-6
  if (ok) { pass++; cur.push(`    [PASS] ${label} = ${JSON.stringify(actual)}`) }
  else { warn++; cur.push(`    [WARN] ${label} = ${JSON.stringify(actual)}(期望 ${JSON.stringify(expected)};该样本现场在录报工,数据会变)`) }
}

async function post(base, path, body, token) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body ?? {}),
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { code: -1, message: text.slice(0, 300) } }
  return { status: res.status, json }
}

async function login(base, factory = 'YJ') {
  const r = await post(base, '/auth/login', { userName: 'admin', password: '123456', factory })
  const token = r.json?.data?.token
  if (!token) throw new Error(`登录失败 ${base}: HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`)
  return token
}

const opRow = (done, op) => (Array.isArray(done) ? done.find((r) => String(r?.工序 ?? '').trim() === op) : undefined)

function dumpDone(done) {
  if (!Array.isArray(done)) return '    (完工数据 缺失)'
  if (done.length === 0) return '    (完工数据 为空数组)'
  return done.map((r) => '    ' + JSON.stringify(r)).join('\n')
}

// ══════════════════════════════════════════════════════════════════════════════════
// 一、完工数据(scheduleBoard/trace)
// ══════════════════════════════════════════════════════════════════════════════════
const TRACE_CASES = [
  {
    key: 'A',
    title: '行级 GD-2026-11-0028-1 行id=3210(成型换算率 0.5;25/50 都是已审,可硬断言)',
    body: { 工单号: 'GD-2026-11-0028-1', 工单行id: 3210 },
    old: { 成型: { 计划数量: 50 }, 装箱: { 计划数量: 50 } },   // 8090 老 jar 实测(Lead 提供)
    expect: {
      成型: { 计划数量: 25, 换算率: 0.5, 完成数量: 25, 待审数量: 0, 单据状态: '已审核' },
      装箱: { 计划数量: 50, 换算率: 1, 完成数量: 50, 待审数量: 0, 单据状态: '已审核' },
    },
  },
  {
    key: 'B',
    title: '行级 GD-2026-11-0028 行id=3209(现场正在录报工 ⇒ 完成/待审只记录)',
    body: { 工单号: 'GD-2026-11-0028', 工单行id: 3209 },
    old: { 成型: { 计划数量: 50 } },
    expect: { 成型: { 计划数量: 25, 换算率: 0.5 } },
    // 🔴 2026-11-15 12:1x 现场把该行 3 条报工**全部作废**(scjl.asp_cancel='Y')
    //   ⇒ 完工数据 按设计返回空数组(本段只统计未作废报工)。数据在动,不能判 FAIL。
    tolerantEmpty: true,
    emptyNote: '该行 3 条报工已被现场全部作废(scjl.asp_cancel=Y)⇒ 完工数据 按设计为空数组',
  },
  {
    key: 'C',
    title: '整单 GD-2026-11-0017(不传行id;行1排产 30 + 行2排产 715,率 1 ⇒ 745)',
    body: { 工单号: 'GD-2026-11-0017' },
    old: { 成型: { 计划数量: 715 } },
    expect: { 成型: { 计划数量: 745, 换算率: 1 } },
  },
  {
    key: 'D',
    title: '整单 GD-2026-09-0009(11 行多行工单;Σ各行排产 = 33700,率 1)',
    body: { 工单号: 'GD-2026-09-0009' },
    old: { 成型: { 计划数量: 20000 }, 切炭: { 计划数量: 20000 }, 组装: { 计划数量: 20000 } },
    expect: {
      成型: { 计划数量: 33700, 换算率: 1 },
      切炭: { 计划数量: 33700, 换算率: 1 },
      组装: { 计划数量: 33700, 换算率: 1 },
    },
  },
  {
    key: 'E',
    title: '草稿样本 GD-2026-10-0226-1 整单(草稿不得冒充完成:完成 0 / 待审 10 / 状态=草稿)',
    body: { 工单号: 'GD-2026-10-0226-1' },
    old: { 组装: { 完成数量: 10, 单据状态: '已审核' } },     // 老口径:SUM(sl) 把草稿混进完成、状态写"已审核"
    expect: { 组装: { 完成数量: 0, 待审数量: 10, 单据状态: '草稿' } },
  },
]

// ══════════════════════════════════════════════════════════════════════════════════
// 二、工序进度(processTask/detail)—— 折成品口径,与上面同源
// ══════════════════════════════════════════════════════════════════════════════════
const PT_CASES = [
  {
    key: 'A',
    title: 'GD-2026-11-0028-1 行id=3210(产出 50 / 进度 100% / 成型 25-25 / 装箱 50-50)',
    body: { 工单号: 'GD-2026-11-0028-1', 工单行id: 3210 },
    expect: { 产出: 50, 进度: 100, 步骤: { 成型: { 完工量: 25, 计划量: 25 }, 装箱: { 完工量: 50, 计划量: 50 } } },
    softFlag: false,
  },
  {
    key: 'B',
    title: 'GD-2026-11-0028 行id=3209(现场已把该行报工全部作废 ⇒ 产出/进度 只记录,不断言)',
    body: { 工单号: 'GD-2026-11-0028', 工单行id: 3209 },
    expect: {},              // 报工全作废:产出 0 / 进度 0 才是当下正确值,只记录
    softFlag: true,
  },
]

// ══════════════════════════════════════════════════════════════════════════════════
log('='.repeat(104))
log('生产工单追溯「完工数据」工序口径计划数量 / 换算率 / 待审数量 —— 接口取证')
log(`修复后实例(8091,新 jar): ${BASE_NEW}`)
log(`对照基线(8090,老 jar):   ${WITH_8090 ? BASE_OLD : '(本次跳过)'}`)
log(`时间: ${new Date().toISOString()}`)
log('='.repeat(104))

// ── 1) 打 8091(修复后) ─────────────────────────────────────────────────────────
const tokenNew = await login(BASE_NEW, 'YJ')
const newTrace = {}
const newPt = {}
for (const c of TRACE_CASES) {
  const r = await post(BASE_NEW, '/px/scheduleBoard/trace', c.body, tokenNew)
  newTrace[c.key] = r.json?.data?.['完工数据']
  if (!r.json?.data) log(`[WARN] trace ${c.key} 无 data: HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
}
for (const c of PT_CASES) {
  const r = await post(BASE_NEW, '/px/processTask/detail', c.body, tokenNew)
  newPt[c.key] = r.json?.data
  if (!r.json?.data) log(`[WARN] processTask/detail ${c.key} 无 data: HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
}

// ── 2) 打 8090(老 jar 对照;失败只 WARN)────────────────────────────────────────
const oldTrace = {}
if (WITH_8090) {
  try {
    const tokenOld = await login(BASE_OLD, 'YJ')
    for (const c of TRACE_CASES) {
      const r = await post(BASE_OLD, '/px/scheduleBoard/trace', c.body, tokenOld)
      oldTrace[c.key] = r.json?.data?.['完工数据']
    }
  } catch (e) {
    log(`[WARN] 8090 对照不可用(不影响主断言): ${e.message}`)
  }
}

// ── 3) 断言 + 原样记录 ─────────────────────────────────────────────────────────
log('')
log('█ 一、POST /api/px/scheduleBoard/trace → data.完工数据')
for (const c of TRACE_CASES) {
  log('─'.repeat(104))
  log(`用例 ${c.key}: ${c.title}`)
  log(`请求体: ${JSON.stringify(c.body)}`)
  log('')
  const done = newTrace[c.key]
  log('  [8091 修复后] data.完工数据 原样:')
  log(dumpDone(done))
  if (oldTrace[c.key]) {
    log('  [8090 修复前] data.完工数据 原样:')
    log(dumpDone(oldTrace[c.key]))
  }
  log('')
  cur = []
  const isEmpty = Array.isArray(done) && done.length === 0
  for (const [op, exp] of Object.entries(c.expect)) {
    const row = opRow(done, op)
    if (!row) {
      if (isEmpty && c.tolerantEmpty) {
        warn++
        cur.push(`    [WARN] 工序「${op}」不存在 —— ${c.emptyNote}(数据变动,不计 FAIL)`)
      } else { fail++; cur.push(`    [FAIL] 工序「${op}」在完工数据里不存在`) }
      continue
    }
    for (const [field, want] of Object.entries(exp)) check(`${op}.${field}`, row[field], want)
  }
  log(cur.join('\n'))
  const cmp = Object.entries(c.old || {}).map(([op, o]) => {
    const now = opRow(done, op)
    const parts = Object.entries(o).map(([f, v]) => `${f}: ${JSON.stringify(v)} → ${JSON.stringify(now?.[f])}`)
    return `${op}(${parts.join(', ')})`
  })
  if (cmp.length) log(`    对照: ${cmp.join(' | ')}`)
  log('')
}

log('')
log('█ 二、POST /api/px/processTask/detail → 折成品口径(产出 / 表头.进度 / 工序步骤)')
for (const c of PT_CASES) {
  log('─'.repeat(104))
  log(`用例 ${c.key}: ${c.title}`)
  log(`请求体: ${JSON.stringify(c.body)}`)
  const d = newPt[c.key]
  if (!d) { fail++; log('    [FAIL] 接口无 data'); continue }
  const steps = d['工序步骤'] || []
  log('  [8091] 关键字段原样:')
  log('    ' + JSON.stringify({
    追溯口径: d['追溯口径'], 计划合计: d['计划合计'], 产出: d['产出'], 进度: d['表头']?.['进度'],
    已完成步骤数: d['已完成步骤数'], 当前工序: d['当前工序'],
    工序步骤: steps.map((s) => ({ 工序: s['工序'], 换算率: s['换算率'], 完工量: s['完工量'], 计划量: s['计划量'], 状态: s['状态'] })),
  }))
  log('')
  cur = []
  const fn = c.softFlag ? soft : check
  if (c.expect.产出 !== undefined) fn('产出', d['产出'], c.expect.产出)
  if (c.expect.进度 !== undefined) fn('表头.进度', d['表头']?.['进度'], c.expect.进度)
  for (const [op, exp] of Object.entries(c.expect.步骤 || {})) {
    const s = steps.find((x) => String(x['工序'] ?? '').trim() === op)
    if (!s) { fail++; cur.push(`    [FAIL] 工序步骤里没有「${op}」`); continue }
    for (const [f, v] of Object.entries(exp)) fn(`步骤.${op}.${f}`, s[f], v)
  }
  log(cur.join('\n'))
  log('')
}

log('='.repeat(104))
log(`汇总: PASS ${pass} / FAIL ${fail} / WARN(现场数据变动,不计失败) ${warn}`)
log(fail === 0 ? 'RESULT: PASS' : 'RESULT: FAIL')
log('='.repeat(104))

writeFileSync(OUT, lines.join('\n') + '\n', 'utf8')
console.log(`\n[写入] ${OUT}`)
process.exitCode = fail === 0 ? 0 : 1
