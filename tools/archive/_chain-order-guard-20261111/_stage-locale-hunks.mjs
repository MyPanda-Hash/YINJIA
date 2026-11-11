/**
 * _stage-locale-hunks.mjs — 只把「本任务新增的 i18n 词条」那几块 hunk 提交进索引
 * (2026-11-11;并行会话同时在改同一批语言包,不能用 `git add <file>` 整文件带走别人的改动)
 *
 * 做法:git diff 出 10 个语言包 → 只保留「新增行含本任务词条」的 hunk → `git apply --cached`。
 * 用法:node tools/archive/_chain-order-guard-20261111/_stage-locale-hunks.mjs
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const FILES = ['de', 'en', 'es', 'fr', 'ja', 'ko', 'ru', 'th', 'vi', 'zh-TW']
  .map((l) => `frontend/src/i18n/locales/${l}.js`)
const MARK = '下道工序的计划开工日期不能早于上道工序的计划完工日期'

const raw = execFileSync('git', ['diff', '-U3', '--', ...FILES], { cwd: repo, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
const lines = raw.split(/\r?\n/)

const files = []
let cur = null
for (const line of lines) {
  if (line.startsWith('diff --git ')) { cur = { header: [line], hunks: [] }; files.push(cur); continue }
  if (!cur) continue
  if (line.startsWith('@@')) { cur.hunks.push({ head: line, body: [] }); continue }
  if (cur.hunks.length) cur.hunks[cur.hunks.length - 1].body.push(line)
  else cur.header.push(line)
}

const out = []
let kept = 0
for (const f of files) {
  const keep = f.hunks.filter((h) => h.body.some((l) => l.startsWith('+') && l.includes(MARK)))
  if (!keep.length) continue
  kept += keep.length
  out.push(...f.header.filter((l) => l !== ''))
  for (const h of keep) {
    const body = [...h.body]
    while (body.length && body[body.length - 1] === '') body.pop()
    out.push(h.head, ...body)
  }
}

const patch = out.join('\n') + '\n'
const patchPath = resolve(repo, 'tools/archive/_chain-order-guard-20261111/_stage-locale.patch')
writeFileSync(patchPath, patch, 'utf8')
console.log(`patch: ${files.length} 个文件里保留 ${kept} 个 hunk`)
try {
  execFileSync('git', ['apply', '--cached', '--recount', patchPath], { cwd: repo, stdio: 'inherit' })
  console.log('git apply --cached OK')
} finally {
  unlinkSync(patchPath)
}
