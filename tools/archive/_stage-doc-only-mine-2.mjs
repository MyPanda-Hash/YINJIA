import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

/**
 * _stage-doc-only-mine-2.mjs — `docs/development/数据库表清单.md` 的 hunk 与另一路会话
 * (成品检验单那批 v3.18..v3.22)挤在同一个 hunk 里,过滤分不开 ⇒ 以 HEAD 为底重放本任务的改动:
 *   ① 版本日志追加 v3.23(首件检验单「测试项目可新增」);
 *   ② 行表 `qc_first_insp_detail` 的说明更新为"可新增列"口径(列数不变,仍 29)。
 * 只写索引(git update-index --cacheinfo),工作区文件一字节不动。
 */
const FILE = 'docs/development/数据库表清单.md'
const git = (a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

let txt = git(['show', 'HEAD:' + FILE])
const before = txt

// ① 行表说明:补「测试项目 = 一列、可新增列」的口径(列数仍 29,不动)
const oldRow = '| `qc_first_insp_detail` | 首件检验单行表(图片版动态长表:一行=标准/样品×动态检验列;样品1#..8#;列按 RD_MOLD_PROC 非空检验要求生成;「标准」填入工艺清单要求;保留实测数值/结果判断) | 29 | QC_FIRST_INSP（首件检验单） |'
const newRow = '| `qc_first_insp_detail` | 首件检验单行表(图片版动态长表:一行=标准/样品×动态检验列;样品1#..8#;列按 RD_MOLD_PROC 非空检验要求生成,**测试项目可在纸上新增/删除/改分组 = 增删列**,加一列写 1 标准行 + 8 样品行;「标准」填入工艺清单要求;保留实测数值/结果判断) | 29 | QC_FIRST_INSP（首件检验单） |'
if (txt.includes(oldRow)) txt = txt.replace(oldRow, newRow)
else console.log('NOTE: 行表说明锚点未命中(可能口径已变),跳过')

// ② 版本日志追加 v3.23(接在版本表最后一行之后)
const v = fs.readFileSync('.esbuild-tmp/_v323.txt', 'utf8').trim()
const lines = txt.split('\n')
let last = -1
for (let i = 0; i < lines.length; i++) if (/^\| v3\.\d+ \|/.test(lines[i])) last = i
if (last < 0) throw new Error('版本表锚点未找到')
lines.splice(last + 1, 0, v)
txt = lines.join('\n')

if (txt === before) throw new Error('重建后与 HEAD 相同,改动没落上')
const tmp = '.esbuild-tmp/_doc-idx2.md'
fs.writeFileSync(tmp, txt, 'utf8')
const sha = git(['hash-object', '-w', tmp]).trim()
git(['update-index', '--cacheinfo', `100644,${sha},${FILE}`])
console.log('索引已重建, blob =', sha.slice(0, 10))
// 复核:索引 → 工作区 的差异应当只剩对方的改动
const d = git(['diff', '--', FILE])
const foreign = d.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
console.log(`索引→工作区 新增行 ${foreign.length}(应全是对方的成品检验单那批):`)
console.log(foreign.map((l) => '   ' + l.slice(1, 100)).join('\n'))
