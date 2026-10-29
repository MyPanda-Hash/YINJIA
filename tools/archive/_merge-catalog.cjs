/**
 * _merge-catalog.cjs — 数据库表清单 v3.5x 维护记录的冲突合并(2026-10-25)
 *
 * 冲突成因:两边各自在表清单末尾追加了「v3.53」维护行 ——
 *   远端 v3.53 = 系统管理平台·菜单设计(已推送,号码已在用)
 *   本地 v3.53..v3.61 = 供应商门户这一整串(9 行,尚未推送)
 *
 * 合并:保留远端的 v3.53,把本地这 9 行**顺延**成 v3.54..v3.62(只改行首版本号,正文一字不动)。
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const REPO = path.join(__dirname, '..', '..')
const REL = 'docs/development/数据库表清单.md'
const FILE = path.join(REPO, REL)

const text = fs.readFileSync(FILE, 'utf8')
const lines = text.split('\n')

// 定位这一处冲突(可能只有一处)
const start = lines.findIndex((l) => l.trim() === '<<<<<<< HEAD')
if (start < 0) { console.log('没有冲突,跳过'); process.exit(0) }
const mid = lines.findIndex((l, i) => i > start && l.trim() === '=======')
const end = lines.findIndex((l, i) => i > mid && l.trim().startsWith('>>>>>>>'))
if (mid < 0 || end < 0) { console.error('冲突块不完整'); process.exit(2) }

const ours = lines.slice(start + 1, mid)      // 本地:v3.53..v3.61(供应商门户一串)
const theirs = lines.slice(mid + 1, end)      // 远端:v3.53(菜单设计)

console.log(`本地 ${ours.length} 行 / 远端 ${theirs.length} 行`)

// 本地这部分整体 +1(3.53→3.54 … 3.61→3.62),避免与远端已占用的 3.53 撞号
const bumped = ours.map((l) => {
  const m = l.match(/^\|\s*v3\.(\d{2})\s*\|/)
  if (!m) return l
  const n = Number(m[1]) + 1
  return l.replace(/^\|\s*v3\.\d{2}\s*\|/, `| v3.${n} |`)
})

const merged = [...theirs, ...bumped]
const out = [...lines.slice(0, start), ...merged, ...lines.slice(end + 1)]
fs.writeFileSync(FILE, out.join('\n'), 'utf8')

const check = fs.readFileSync(FILE, 'utf8')
const markers = (check.match(/^(<<<<<<<|=======|>>>>>>>)/gm) || []).length
console.log(`已合并;剩余冲突标记 ${markers}`)
const vers = [...check.matchAll(/^\|\s*(v3\.\d+)\s*\|/gm)].map((m) => m[1])
const dup = vers.filter((v, i) => vers.indexOf(v) !== i)
console.log(`维护记录 ${vers.length} 条;重复版本号: ${dup.length ? dup.join(',') : '无'}`)
console.log(`首尾: ${vers[0]} .. ${vers[vers.length - 1]}`)
