#!/usr/bin/env node
/**
 * 生产工序进度看板 · 工序可点 + 检验单跳转（2026-11-13）
 * i18n 词条覆盖自查（契约 §5）
 *
 * 断言（每个 locale 各 2 项）：
 *   1) 契约 §5 表里的 8 条中文 key，在该 locale 的 biz 字典里**恰好作为条目出现 1 次**
 *      （0 = 漏译；>=2 = 重复键，后者静默覆盖前者）。
 *      注意：只能按「条目行首」计数，不能按裸字符串计数 —— zh-TW 的 '已定位': '已定位'
 *      键与译文同形，裸串会数成 2 次（首版脚本就踩了这个假阳性）。
 *   2) 该语言包能被 V8 真正解析（data:URL 动态 import），且 default.biz[key] 是非空、无换行字符串。
 *
 * zh-CN 按既有惯例不参与：它是源语言（tt() 对 zh-CN 原样返回），且 zh-CN.js 只装
 * 框架级命名空间(locale/common/topbar/login)，**没有 biz 段**。
 *
 * 用法：node tools/archive/_wo-progress-click-20261113/_i18n-check.mjs
 * 退出码 0 = 全 PASS；1 = 有 FAIL。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../..')
const LOCALES_DIR = resolve(ROOT, 'frontend/src/i18n/locales')

/** 语言档位：契约 §5（zh-CN.js 无 biz 段，按既有惯例不参与） */
const LOCALES = ['de', 'en', 'es', 'fr', 'ja', 'ko', 'ru', 'th', 'vi', 'zh-TW']

/** 契约 §5 表格里的 8 条中文串（原样作 key，不要改字） */
const KEYS = [
  '该工单未进行排产',
  '该工序未到达',
  '该工序暂无检验单',
  '未在工单排产中找到该工单行',
  '点击工序跳转到该工序排产',
  '点击查看检验单',
  '已定位',
  '点击行可跳转到生产工单并定位该工单；点击工序跳转到该工序排产，点击检验标记打开检验单',
]

const esc = (s) => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')

/**
 * 统计「条目行」次数：行首缩进 + 'key' + 冒号。
 * 这样既避开「值里恰好吃到同串」（zh-TW 已定位），也避开短键被长键子串命中
 * （长键在 工单 后面接的是 ；，不是收尾引号）。
 */
function countEntry(src, key) {
  const re = new RegExp(`^[ \\t]*'${esc(key)}'[ \\t]*:`, 'gm')
  return (src.match(re) || []).length
}

const rows = []
const bad = []

for (const loc of LOCALES) {
  const file = resolve(LOCALES_DIR, `${loc}.js`)
  if (!existsSync(file)) {
    bad.push(`${loc}.js 不存在`)
    continue
  }
  const src = readFileSync(file, 'utf8')
  const counts = KEYS.map((k) => countEntry(src, k))
  const missing = KEYS.filter((_, i) => counts[i] === 0)
  const dupes = KEYS.filter((_, i) => counts[i] > 1).map((k) => `${k} ×${countEntry(src, k)}`)

  // ---- 真解析一遍语言包，确认没有语法错、且 biz 里真有这几条 ----
  let modOk = true
  let modErr = ''
  let values = []
  try {
    const url = 'data:text/javascript;base64,' + Buffer.from(src, 'utf8').toString('base64')
    const mod = await import(url)
    const biz = mod.default?.biz
    if (!biz) {
      modOk = false
      modErr = 'default.biz 不存在'
    } else {
      for (const k of KEYS) {
        const v = biz[k]
        if (typeof v !== 'string' || !v.trim()) {
          modOk = false
          modErr = `biz['${k}'] 不是非空字符串`
          break
        }
        if (v.includes('\n')) {
          modOk = false
          modErr = `biz['${k}'] 含换行`
          break
        }
      }
      values = KEYS.map((k) => biz[k])
    }
  } catch (e) {
    modOk = false
    modErr = String(e && e.message ? e.message : e)
  }

  const ok = missing.length === 0 && dupes.length === 0 && modOk
  rows.push({ locale: loc, counts, missing, dupes, modOk, modErr, values, ok })
  if (missing.length) bad.push(`${loc}: 缺 ${missing.length} 条 -> ${missing.join(' / ')}`)
  if (dupes.length) bad.push(`${loc}: 重复键 ${dupes.length} 条 -> ${dupes.join(' / ')}`)
  if (!modOk) bad.push(`${loc}: 语言包解析/biz 取值失败 -> ${modErr}`)
}

// ---- 输出 1：每 locale × 每 key 的条目次数矩阵 ----
const head = ['locale', ...KEYS.map((_, i) => `K${i + 1}`), 'parse']
const table = rows.map((r) => [
  r.locale,
  ...r.counts.map((n) => (n === 1 ? '✓' : String(n))),
  r.modOk ? 'OK' : 'ERR',
])
const widths = head.map((h, i) => Math.max(h.length, ...table.map((t) => (t[i] || '').length)))
const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ')

console.log('\n== 契约 §5：8 个 key × 10 个 locale（✓ = 恰好 1 条；parse = 语言包可解析且 biz 取值正常）==')
console.log(line(head))
console.log(widths.map((w) => '-'.repeat(w)).join('  '))
for (const t of table) console.log(line(t))
console.log('')
console.log('K1 该工单未进行排产            K2 该工序未到达          K3 该工序暂无检验单')
console.log('K4 未在工单排产中找到该工单行  K5 点击工序跳转到该工序排产  K6 点击查看检验单')
console.log('K7 已定位                      K8 点击行可跳转到生产工单并定位该工单；点击工序…（长句）')

// ---- 输出 2：en 译文全表 ----
const en = rows.find((r) => r.locale === 'en')
if (en) {
  console.log('\n== en 译文（契约 §5 对照）==')
  KEYS.forEach((k, i) => console.log(`  ${k}\n    -> ${en.values[i]}`))
}

// ---- 输出 3：zh-CN 不参与的既有惯例依据（仅提示，不断言）----
const zhCN = readFileSync(resolve(LOCALES_DIR, 'zh-CN.js'), 'utf8')
const zhCNHasBiz = /^\s*biz\s*:/m.test(zhCN)
console.log(`\n[info] zh-CN.js 有 biz 段: ${zhCNHasBiz}（false ⇒ 源语言文件不加词条；tt() 对 zh-CN 原样返回）`)

console.log('')
for (const b of bad) console.log(`[FAIL] ${b}`)
const totalChecks = rows.length * (KEYS.length + 1)
if (bad.length === 0) {
  console.log(`RESULT: PASS — ${rows.length} locale × (${KEYS.length} key 各恰好 1 条 + 语言包可解析) = ${totalChecks} 项全部通过`)
  process.exit(0)
} else {
  console.log(`RESULT: FAIL — ${bad.length} 个问题（检查项 ${totalChecks} 项）`)
  process.exit(1)
}
