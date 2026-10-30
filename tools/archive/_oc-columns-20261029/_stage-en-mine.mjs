/**
 * _stage-en-mine.mjs — 把 en.js 的**本轮 3 行**单独放进索引,不夹带另一任务(日排产)的 25 条词条。
 *
 * 背景(2026-10-29):工作区 en.js 同时有①本轮「订单结转列设置/调整列顺序」词条、
 * ②上一任务「日排产」25 行(尚未提交)。按仓库「单任务单提交」规范,本轮 commit 只应包含①。
 * 做法:取 HEAD 版本 → 精确插入本轮词条(HEAD 里已有的行自动跳过)→ hash-object -w --no-filters
 * → update-index --cacheinfo 覆盖索引里那份;工作区文件保持不动(另一任务的行仍是未暂存改动)。
 *
 * ⚠ `--no-filters` 必须加:本机 core.autocrlf=true,`git hash-object -w` 会把文件按文本清理过滤器
 *   归一化行尾(实测把 HEAD 里后半段本来的 47 处 CRLF 改成 LF)⇒ 提交会多出几十行"行尾变更"噪音。
 *
 * 用法:node tools/archive/_oc-columns-20261029/_stage-en-mine.mjs
 * 然后:git diff --cached -- frontend/src/i18n/locales/en.js 应只有本轮新增行
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const ROOT = 'D:/workspace/yinjia'
const REL = 'frontend/src/i18n/locales/en.js'
const head = execFileSync('git', ['-C', ROOT, 'show', `HEAD:${REL}`], { encoding: 'utf8' })
const work = fs.readFileSync(`${ROOT}/${REL}`, 'utf8')

const lines = work.split(/\r?\n/)
const start = lines.findIndex((l) => l.includes('日期查询改「日期范围」选择'))
const end = lines.findIndex((l) => l.includes('当天没数据 → 弹窗询问'))
if (start < 0 || end < 0 || end <= start) throw new Error('工作区里找不到本轮词条块的边界(start/end)')
const block = lines.slice(start, end)

// 本轮**改写/删除**的旧词条(在 HEAD 里存在、工作区已删):从 HEAD 版里摘掉,避免留下死词条
const DROP = [
  "    '勾选决定显示哪几列;▲▼ 调整列顺序(上移=靠左)': 'Tick to show columns; ▲▼ reorders them (up = further left)',",
]
let base = head
for (const line of DROP) {
  if (!base.includes(line)) throw new Error('要删除的旧词条不在 HEAD 里: ' + line)
  base = base.replace(line + '\n', '')
}

const missing = block.filter((l) => {
  const t = l.trim()
  return t && !base.includes(t)
})
if (!missing.length && DROP.length === 0) throw new Error('HEAD 已包含本轮全部词条,无需插入')
if (missing.some((l) => !/^\s*(\/\/|'[^']+':\s*')/.test(l))) {
  throw new Error('本轮词条块里有无法识别的行: ' + JSON.stringify(missing.filter((l) => !/^\s*(\/\/|'[^']+':\s*')/.test(l))))
}

const anchor = "    '看近7天': 'View last 7 days',"
if (!base.includes(anchor)) throw new Error('HEAD 版本里找不到插入锚点')

const staged = base.replace(anchor, anchor + (missing.length ? '\n' + missing.join('\n') : ''))
const tmp = `${ROOT}/tools/archive/_oc-columns-20261029/_en-staged.js`
fs.writeFileSync(tmp, staged, 'utf8')
const hash = execFileSync('git', ['-C', ROOT, 'hash-object', '-w', '--no-filters', tmp], { encoding: 'utf8' }).trim()
execFileSync('git', ['-C', ROOT, 'update-index', '--cacheinfo', `100644,${hash},${REL}`], { encoding: 'utf8' })
console.log(`已把 en.js 本轮 ${missing.length} 行放进索引:`)
console.log(missing.join('\n'))
console.log(`blob=${hash}`)
