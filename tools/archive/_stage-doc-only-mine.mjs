import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

/**
 * _stage-doc-only-mine.mjs — `docs/development/数据库表清单.md` 与另一路会话的 v3.18 行**挤在同一个
 * hunk** 里(hunk 过滤分不开),故改为「以 HEAD 版本为底,重放本任务的 4 处改动」重建索引内容:
 *   ① §五 品质管理 表数 34 → 36;② 追加 qc_first_insp_head/_detail 两行;③ 版本日志追加 v3.19 行。
 * 只写索引(git update-index --cacheinfo),**工作区文件一个字节都不动**(对方在途改动原样留着)。
 */
const FILE = 'docs/development/数据库表清单.md'
const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts })

let txt = git(['show', 'HEAD:' + FILE])
const nl = txt.includes('\r\n') ? '\r\n' : '\n'
const before = txt

// ① 表数 34 → 36(只认 §五 品质管理 那一段:紧跟「品检分流后的质检单据…头行成对。」之后)
const anchorCount = '品检分流后的质检单据：来料检验/制程检验/不合格处理/特采/紧急放行等，全部头行成对。'
const i = txt.indexOf(anchorCount)
if (i < 0) throw new Error('未找到 §五 段首锚点')
const j = txt.indexOf('> 共 34 张', i)
if (j < 0) throw new Error('未找到 §五 的「共 34 张」')
txt = txt.slice(0, j) + '> 共 36 张' + txt.slice(j + '> 共 34 张'.length)

// ② 两行新表(追加在 `qc_proc_insp_detail` 行之后)
const rowAnchor = '| `qc_proc_insp_detail` |'
const k = txt.indexOf(rowAnchor)
if (k < 0) throw new Error('未找到 qc_proc_insp_detail 行')
const eol = txt.indexOf('\n', k)
const rows = [
  '| `qc_first_insp_head` | 首件检验单头表(2026-10-15 按流程图第2步「车间生产(首批)」建;实现方式照组装成品检验单;本(工单号,批次号,工单行号)第一张报工审核时自动出草稿;`工艺清单单号`=检验要求的来源《成型工艺清单》RD_MOLD_PROC) | 33 | QC_FIRST_INSP（首件检验单） |',
  '| `qc_first_insp_detail` | 首件检验单行表(表区=检验项目/数量判定:项目/检验要求/检验方法/检查频率/实测数值/测量值1..5/结果判断/数量/不合格数量/处理方式;生成时按《成型工艺清单》的检验要求预铺 炭棒尺寸·密度管控·跌落强度·抗压强度·压降 5 项) | 24 | QC_FIRST_INSP（首件检验单） |',
]
txt = txt.slice(0, eol + 1) + rows.join(nl) + nl + txt.slice(eol + 1)

// ③ 版本日志追加 v3.19(接在表格最后一行 v3.16 之后)
const v319 = fs.readFileSync('.esbuild-tmp/_v319.txt', 'utf8').trim()
txt = txt.replace(/\s*$/, nl) + v319 + nl

if (txt === before) throw new Error('重建后与 HEAD 完全相同,改动没落上')

const tmp = '.esbuild-tmp/_doc-index.md'
fs.writeFileSync(tmp, txt, 'utf8')
const sha = git(['hash-object', '-w', tmp]).trim()
git(['update-index', '--cacheinfo', `100644,${sha},${FILE}`])
console.log('已把「HEAD + 本任务 4 处改动」写进索引, blob =', sha.slice(0, 10))

// 复核:索引 vs 工作区 的差异应当**只剩对方的改动**
const d = git(['diff', '--', FILE])
const foreign = d.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
console.log(`索引→工作区 差异新增行 ${foreign.length} 行(应全部是另一路会话的 v3.18 相关):`)
console.log(foreign.map((l) => '   ' + l.slice(1, 120)).join('\n'))
