/**
 * _merge-lists.mjs — 清单型文件的冲突合并(2026-11-01)
 *
 * 为什么单独写:tools/db-inuse-tables.txt / db-migrations.txt 这类文件两边都在**追加**条目,
 * git 的文本合并会把整块判成冲突(因为大家都在同一区域加行)。手工挑会漏。
 * 这里按"条目键"做并集:
 *   · ours 的行**全部保留**(顺序不动);
 *   · theirs 里 ours 没有的条目,追加到末尾(保持 theirs 的相对顺序)。
 * 键的提取:table:xxx / migrate-xxx.sql / 其它行按整行文本。
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const path = process.argv[2]
if (!path) { console.error('用法: node _merge-lists.mjs <path>'); process.exit(1) }

const show = (stage) => {
  try {
    // ⚠ 语法是 `:2:<path>`(冒号在最前),写成 `2:<path>` 会报 invalid object name。
    return execFileSync('git', ['show', `:${stage}:${path}`], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return Buffer.alloc(0)
  }
}

const decode = (buf) => {
  let s = buf.toString('utf8')
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1)
  return s
}

const ours = decode(show(2))
const theirs = decode(show(3))

const keyOf = (line) => {
  const t = line.trim()
  const m = t.match(/^table:(\S+)/)
  if (m) return `table:${m[1]}`
  const g = t.match(/^(migrate-[\w.-]+\.sql)\s*$/)
  if (g) return `migrate:${g[1]}`
  if (t === '' || t.startsWith('#')) return null   // 注释/空行不参与去重
  return `line:${t}`
}

const seen = new Set()
for (const l of ours.split(/\r?\n/)) {
  const k = keyOf(l)
  if (k) seen.add(k)
}

const extra = []
for (const l of theirs.split(/\r?\n/)) {
  const k = keyOf(l)
  if (!k) continue
  if (seen.has(k)) continue
  seen.add(k)
  extra.push(l)
}

const NL = ours.includes('\r\n') ? '\r\n' : '\n'
let out = ours.replace(/\s*$/, '') + NL
if (extra.length) {
  out += NL + '# ── 以下条目由远端(origin/main)合并带入,原文件里没有 ──' + NL
  for (const l of extra) out += l + NL
}

writeFileSync(path, out, 'utf8')
console.log(`[merge] ${path}: ours ${ours.split(/\r?\n/).length} 行,追加 ${extra.length} 条`)
