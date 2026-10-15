import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

/**
 * _merge-my-version-rows.mjs — 我的首件检验在版本表里留了两行(v3.21 图片版动态长表 / v3.23 测试项目可新增),
 * 而另一路会话也占了 v3.21 ⇒ 号重复。这里把两行合成一行(v3.23),保留全部信息、消掉重号。
 * 只写索引。
 */
const FILE = 'docs/development/数据库表清单.md'
const git = (a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let s = git(['show', ':' + FILE])
const lines = s.split('\n')
const iOld = lines.findIndex((l) => l.startsWith('| v3.21 | 2026-10-15 | **首件检验单改为图片版动态长表**'))
const iNew = lines.findIndex((l) => l.startsWith('| v3.23 | 2026-10-15 |'))
if (iOld < 0 || iNew < 0) { console.error('row miss', iOld, iNew); process.exit(1) }
// 把旧行的正文($2 描述)并入新行:新行已含"可新增列/版式对齐图片";这里补上旧行的"29 列/5 个字段/两账套已执行"
const oldBody = lines[iOld]
const keep = '⚠ 前一批(v3.22 之前的同批工作)已把明细改为「标准/样品 × 动态检验列」长表并加 `行类型`/`样品序号`/`检验列`/`标准`/`项目分组` 5 列(24→29),两账套已执行。'
lines[iNew] = lines[iNew].replace(/ \|$/, ' ' + keep + ' |')
lines.splice(iOld, 1)
s = lines.join('\n')
const tmp = '.esbuild-tmp/_doc-idx3.md'
fs.writeFileSync(tmp, s, 'utf8')
const sha = git(['hash-object', '-w', tmp]).trim()
git(['update-index', '--cacheinfo', `100644,${sha},${FILE}`])
console.log('merged, blob =', sha.slice(0, 10))
const out = git(['show', ':' + FILE]).split('\n').filter((l) => /^\| v3\.2[0-3] /.test(l))
console.log(out.map((l) => l.slice(0, 58)).join('\n'))
