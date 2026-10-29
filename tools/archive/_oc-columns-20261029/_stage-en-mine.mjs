/**
 * _stage-en-mine.mjs — 把 en.js 的**本轮 3 行**单独放进索引,不夹带另一任务(日排产)的 25 条词条。
 *
 * 背景(2026-10-29):工作区 en.js 同时有①本轮「列设置/下单日期」3 行、②上一任务「日排产」25 行
 * (尚未提交)。按仓库「单任务单提交」规范,本轮 commit 只应包含①。
 * 做法:取 HEAD 版本 → 精确插入这 3 行 → hash-object -w → update-index --cacheinfo 覆盖索引里那份;
 * 工作区文件保持不动(另一任务的行仍是未暂存改动)。
 *
 * 用法:node tools/archive/_oc-columns-20261029/_stage-en-mine.mjs
 * 然后:git diff --cached -- frontend/src/i18n/locales/en.js 应是"仅 +3 行"
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const ROOT = 'D:/workspace/yinjia'
const REL = 'frontend/src/i18n/locales/en.js'
const head = execFileSync('git', ['-C', ROOT, 'show', `HEAD:${REL}`], { encoding: 'utf8' })
const work = fs.readFileSync(`${ROOT}/${REL}`, 'utf8')

const lines = work.split(/\r?\n/)
const i = lines.findIndex((l) => l.includes('日期查询改「日期范围」选择'))
if (i < 0) throw new Error('工作区里找不到本轮的注释锚点')
const mine = lines.slice(i, i + 3)
if (!mine[1].includes("'列设置'") || !mine[2].includes("'下单日期'")) {
  throw new Error('提取到的 3 行不是本轮的词条: ' + JSON.stringify(mine))
}
const anchor = "    '看近7天': 'View last 7 days',"
if (!head.includes(anchor)) throw new Error('HEAD 版本里找不到插入锚点')
if (head.includes("'列设置'")) throw new Error('HEAD 已经有「列设置」词条,别重复插入')

const staged = head.replace(anchor, anchor + '\n' + mine.join('\n'))
const tmp = `${ROOT}/tools/archive/_oc-columns-20261029/_en-staged.js`
fs.writeFileSync(tmp, staged, 'utf8')
// ⚠ 必须 --no-filters:本机 core.autocrlf=true,`git hash-object -w` 会把文件按文本清理过滤器
//   归一化行尾(实测把 HEAD 里后半段本来的 47 处 CRLF 改成 LF)⇒ 提交会多出 47 行"行尾变更"噪音,
//   与"只加 3 行"的目标不符。--no-filters = 原样入库,blob 与 HEAD 字节级可比。
const hash = execFileSync('git', ['-C', ROOT, 'hash-object', '-w', '--no-filters', tmp], { encoding: 'utf8' }).trim()
execFileSync('git', ['-C', ROOT, 'update-index', '--cacheinfo', `100644,${hash},${REL}`], { encoding: 'utf8' })
console.log('已把 en.js 的本轮 3 行放进索引:')
console.log(mine.join('\n'))
console.log(`blob=${hash}`)
