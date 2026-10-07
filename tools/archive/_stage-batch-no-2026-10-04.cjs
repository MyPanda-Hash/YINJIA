/**
 * _stage-batch-no-2026-10-04.cjs — 把**本次任务(批次号口径:生单即定号)**的改动精确暂存到索引。
 *
 * 为什么需要它:同一工作区里还有**另一个任务**(特采单 QC_TC_IN 两级审批,同为 2026-10-04)的
 * 未提交改动,且与本任务**同文件**(ButtonService.java / PanelxList.vue / 10 个 i18n 语言包 /
 * tools/db-migrations.txt)。AGENTS.md「单任务单提交、不夹带其它任务改动」要求在 **hunk 粒度**上分开:
 * 只暂存"含本任务特征串"的 hunk,其余原样留在工作区。
 *
 * 判据(本任务特征串):批次号相关的标识符/文案 —— 见 MINE。
 * 另一任务的特征串(批准/TWO_LEVEL/ADMIN_L2/一级审核/特采单两级/qc-tcin-twolevel)不含在内。
 *
 * 用法:node tools/archive/_stage-batch-no-2026-10-04.cjs
 * 跑完自己核对:git diff --cached --stat
 */
'use strict'
const { execFileSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

/** 与另一任务**同文件**、需要 hunk 级筛选的路径 */
const SHARED = [
  'backend/src/main/java/com/yinjia/mes/service/ButtonService.java',
  'frontend/src/core/views/PanelxList.vue',
  'frontend/src/i18n/locales/en.js',
  'frontend/src/i18n/locales/zh-TW.js',
  'frontend/src/i18n/locales/ja.js',
  'frontend/src/i18n/locales/ko.js',
  'frontend/src/i18n/locales/de.js',
  'frontend/src/i18n/locales/fr.js',
  'frontend/src/i18n/locales/es.js',
  'frontend/src/i18n/locales/ru.js',
  'frontend/src/i18n/locales/vi.js',
  'frontend/src/i18n/locales/th.js',
  // ⚠ tools/db-migrations.txt **不在此按 hunk 处理**:两个任务的追加块紧挨着、落在同一个 hunk 里,
  //   整块暂存会让清单引用**尚未提交**的 migrate-qc-tcin-twolevel.sql(DbSync 直接找不到文件)。
  //   见下方 stageMigrationList() 的"临时改写 → git add → 还原"做法。
]

/** 迁移清单:本任务块 vs 另一任务块的分界(本任务块在前) */
const MIG_LIST = 'tools/db-migrations.txt'
const MIG_MINE_ANCHOR = '# —— 2026-10-04 批次号口径变更'
const MIG_THEIRS_ANCHOR = '# —— 2026-10-04 特采单(QC_TC_IN)改两级审批'

/** 本任务专有(整文件提交,与另一任务无交集) */
const MINE_ONLY = [
  'backend/src/main/java/com/yinjia/mes/panel/PushGenerateHandler.java',
  'backend/src/main/java/com/yinjia/mes/service/BatchService.java',
  'backend/src/main/java/com/yinjia/mes/service/QcCatalogService.java',
  'backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java',
  'backend/src/main/java/com/yinjia/mes/service/StockLedgerService.java',
  'frontend/src/core/panel/docDefaults.js',
  'frontend/src/core/panel/docDefaults.test.js',
  'frontend/src/core/views/BatchSendDialog.vue',
  'tools/migrate-batch-link.sql',
  'tools/migrate-batch-no-on-generate.sql',
  'tools/archive/_i18n-batch-no-2026-10-04.mjs',
  'tools/archive/_verify-batch-no-on-generate.mjs',
  'tools/archive/_verify-batch-no-ui.cjs',
  'tools/archive/_probe-ui-debug.cjs',
]

/** hunk 归属判据:命中任一即视为本任务 */
const MINE = [
  /syncBatchNo/, /assignBatchNoOnInbound/, /assignNoAndBackfill/, /findPendingBatchId/, /createPending/,
  /refreshBatchNosFromInsp/, /backfillBatchNo/, /buildBatchNo/,
  /detailBatchLocked/, /batchChainPanel/, /cell-locked/, /onBatchGenerated/,
  /syncBatchNoWithDocDate/, /docNoFromDate/,
  /生单时按供应商编码与当天日期生成/, /随单头批次号一致/,
  /migrate-batch-no-on-generate/, /migrate-batch-link/,
  /批次号/, /批次键/,
]

function splitDiff(text) {
  const lines = text.split('\n')
  const head = []
  const hunks = []
  let cur = null
  for (const line of lines) {
    if (line.startsWith('@@')) { if (cur) hunks.push(cur); cur = [line]; continue }
    if (cur) cur.push(line)
    else head.push(line)
  }
  if (cur) hunks.push(cur)
  return { head, hunks }
}

let stagedHunks = 0, skippedHunks = 0
const DRY = process.argv.includes('--dry')
for (const f of SHARED) {
  const d = git(['diff', '--', f])
  if (!d.trim()) { console.log(`- ${f}: 无改动,跳过`); continue }
  const { head, hunks } = splitDiff(d)
  const keep = []
  for (const h of hunks) {
    const body = h.join('\n')
    const hit = MINE.find((re) => re.test(body))
    if (hit) keep.push(h)
    if (DRY || !hit) {
      const added = h.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1).trim()).filter(Boolean)
      console.log(`  ${hit ? '[本任务]' : '[其它任务]'} ${f} ${h[0].slice(0, 40)}`)
      console.log(`      匹配=${hit || '无'} | 新增行样例: ${JSON.stringify(added.slice(0, 2))}`)
    }
    if (hit) stagedHunks++; else skippedHunks++
  }
  if (DRY) continue
  if (!keep.length) { console.log(`- ${f}: 没有本任务的 hunk`); continue }
  // ⚠ 每个 hunk 的最后一个元素是 split('\n') 留下的空串 —— 必须先掐掉再拼,
  //   否则 hunk 尾部与下一个 hunk 的 '@@' 会粘成同一行,git apply 报 "patch does not apply"
  //   (2026-10-04 本脚本第一版就栽在这)。
  const patch = head.join('\n') + '\n'
    + keep.map((h) => h.join('\n').replace(/\n+$/, '')).join('\n') + '\n'
  const tmp = path.join(os.tmpdir(), 'stage-' + path.basename(f) + '.patch')
  fs.writeFileSync(tmp, patch, 'utf8')
  try {
    git(['apply', '--cached', '--whitespace=nowarn', tmp])
    console.log(`+ ${f}: 暂存 ${keep.length} 个 hunk`)
  } catch (e) {
    const detail = [e.stderr, e.stdout, e.message].map((x) => (x ? x.toString() : '')).join('\n').trim()
    console.error(`✗ ${f}: git apply --cached 失败\n${detail.slice(0, 1500)}`)
    fs.writeFileSync(path.join(ROOT, 'tools', 'archive', '_stage-last.patch'), patch, 'utf8')
    console.error(`  补丁已留档:tools/archive/_stage-last.patch`)
    process.exit(1)
  } finally { fs.unlinkSync(tmp) }
}

if (DRY) {
  console.log(`\n[DRY] 本任务 hunk ${stagedHunks} 个 / 其它任务 hunk ${skippedHunks} 个(未做任何暂存)`)
  process.exit(0)
}

/**
 * tools/db-migrations.txt:只把**本任务的追加块**入索引。
 * 做法:读 HEAD 版 → 追加本任务块 → 写入工作区文件 → git add(此刻索引 = 只含本任务块)
 *       → 立刻把工作区文件还原成"两块都在"的真实状态(另一任务的改动原样留在工作区)。
 */
function stageMigrationList() {
  const abs = path.join(ROOT, MIG_LIST)
  const full = fs.readFileSync(abs, 'utf8')
  const i = full.indexOf(MIG_MINE_ANCHOR)
  const j = full.indexOf(MIG_THEIRS_ANCHOR)
  if (i < 0) { console.error('✗ 迁移清单找不到本任务块锚点,放弃暂存该文件'); process.exit(1) }
  const myBlock = full.slice(i, j < 0 ? undefined : j)
  const headVer = git(['show', `HEAD:${MIG_LIST}`])
  fs.writeFileSync(abs, headVer.replace(/\s*$/, '\n') + myBlock, 'utf8')
  try {
    git(['add', '--', MIG_LIST])
    console.log(`+ ${MIG_LIST}: 只暂存本任务块(${myBlock.trim().split('\n').length} 行,另一任务块留在工作区)`)
  } finally {
    fs.writeFileSync(abs, full, 'utf8')   // 还原工作区:另一任务的改动不丢
  }
}
stageMigrationList()

for (const f of MINE_ONLY) {
  try { git(['add', '--', f]); console.log(`+ ${f}: 整文件暂存`) }
  catch (e) { console.error(`✗ ${f}: git add 失败 ${String(e.message).slice(0, 200)}`); process.exit(1) }
}

console.log(`\n完成:hunk ${stagedHunks} 个已暂存,${skippedHunks} 个留给其它任务`)
console.log('核对:git diff --cached --stat')
