/**
 * _merge-i18n.mjs — 多语言词条文件的冲突合并(2026-11-01)
 *
 * 场景:tasks 里 en.js/ja.js 两边都在同一区域追加了**不同功能**的词条,
 * git 判成整块冲突。这里按「词条 key」做并集:
 *   · ours 侧原样保留(顺序不动);
 *   · theirs 侧只补 ours 没有的 key;
 *   · 注释行不参与去重(都保留 ours 的;theirs 的注释若紧邻新增词条则一并带来)。
 *
 * key 口径:`'中文': '值',` 取第一个单引号里的文本;取不到就用整行文本兜底。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const path = process.argv[2]
if (!path) { console.error('用法: node _merge-i18n.mjs <path>'); process.exit(1) }

const raw = readFileSync(path, 'utf8')
const NL = raw.includes('\r\n') ? '\r\n' : '\n'
const lines = raw.split(/\r?\n/)

let lt = -1, eq = -1, gt = -1
for (let i = 0; i < lines.length; i++) {
  if (/^<<<<<<</.test(lines[i])) lt = i
  else if (/^=======$/.test(lines[i]) && lt >= 0) eq = i
  else if (/^>>>>>>>/.test(lines[i]) && eq >= 0) { gt = i; break }
}
if (lt < 0 || eq < 0 || gt < 0) {
  console.log(`[skip] ${path}: 没有冲突块`)
  process.exit(0)
}

const ours = lines.slice(lt + 1, eq)
const theirs = lines.slice(eq + 1, gt)

const keyOf = (l) => {
  const m = l.match(/^\s*'([^']+)'\s*:/)
  if (m) return `k:${m[1]}`
  const d = l.match(/^\s*([\u4e00-\u9fa5][^:]*?)\s*:/)
  if (d) return `k:${d[1].trim()}`
  if (/^\s*\/\//.test(l) || l.trim() === '') return null
  return `l:${l.trim()}`
}

const seen = new Set()
for (const l of ours) { const k = keyOf(l); if (k) seen.add(k) }

const extra = []
for (const l of theirs) {
  const k = keyOf(l)
  if (!k) continue
  if (seen.has(k)) continue
  seen.add(k)
  extra.push(l)
}

const outLines = [...lines.slice(0, lt), ...ours]
if (extra.length) outLines.push(...extra)
outLines.push(...lines.slice(gt + 1))

writeFileSync(path, outLines.join(NL), 'utf8')
console.log(`[merge] ${path}: ours ${ours.length} 行, theirs 新增 ${extra.length} 条`)
