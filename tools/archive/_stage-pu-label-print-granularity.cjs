/**
 * _stage-pu-label-print-granularity.cjs — 把**本次任务(材料码打印粒度/合并/锁定/补登)**的改动精确暂存。
 *
 * 为什么又要 hunk 级:同一工作区还压着**另一个任务**(暂收单生单拆「生成检验或入库单」+ 明细派生列
 * 服务端重算)的未提交改动,与本任务**同文件**:
 *   · PushGenerateHandler.java —— 他们改 PUSH_TARGETS(@74 附近),我改批次行/合并(@310 起)
 *   · PanelxList.vue         —— 他们改 calculateDetailRow/onButton,我改批次号锁定与角标
 *   · en.js / zh-TW.js       —— 他们插「请在列表页继续填写」等,我插打印相关的词条
 * AGENTS.md「单任务单提交、不夹带其它任务改动」要求在 hunk 粒度分开:只暂存"含本任务特征串"的 hunk。
 *
 * 用法:node tools/archive/_stage-pu-label-print-granularity.cjs [--dry]
 * 跑完自己核对:git diff --cached --stat
 */
'use strict'
const { execFileSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

/** 与另一任务同文件 ⇒ 按 hunk 挑 */
const SHARED = {
  'backend/src/main/java/com/yinjia/mes/panel/PushGenerateHandler.java': [
    /isSupplement/, /补登/, /合并成一行明细/, /groupIndex/, /groupKeys/, /合并后的本次送料数量/,
    // ⚠ 合并那步还把 occupied 的 for 循环从"按下标"改成"按行键取分组下标" —— 这个 hunk 里没有
    //   中文关键字,必须单独列出来:**漏了它暂存出来的代码是编译不过的**(下标与分组对不上)
    /for \(Map<String, Object> pk : picked\)/, /Integer tgtId/,
  ],
  'frontend/src/core/views/PanelxList.vue': [
    /printBatchLock/, /field-lock-badge/, /材料码批次号锁定/, /puLabelBatchLock/,
  ],
  'frontend/src/i18n/locales/en.js': [
    /已生单可补打/, /可一次勾选多行/, /已生单补登/, /可补打/, /去向单据/, /张打印单/, /将生成/,
    /已补打/, /'用途'/, /'待生单'/, /重打/, /一次只打一行/, /本次选中/, /请选中一行/, /请先选中一行/,
  ],
  'frontend/src/i18n/locales/zh-TW.js': [
    /已生單可補打/, /可一次勾選多行/, /已生單補登/, /可補打/, /去向單據/, /張列印單/, /將產生/,
    /已補打/, /'用途'/, /'待生單'/, /重打/, /一次只打一行/, /本次選中/, /請選中一行/, /請先選中一行/,
    /已生单可补打/, /可一次勾选多行/, /已生单补登/, /去向单据/, /张打印单/, /将生成/,
  ],
}

/** 本任务专有(整文件暂存) */
const MINE_ONLY = [
  'backend/src/main/java/com/yinjia/mes/service/PuLabelService.java',
  'backend/src/main/java/com/yinjia/mes/controller/PxController.java',
  'frontend/src/business/engine.js',
  'frontend/src/core/views/MaterialLabelDialog.vue',
  'tools/migrate-pu-label-one-line-per-print.sql',
  'tools/migrate-pu-label-supplement-print.sql',
  'tools/archive/_i18n-material-label-2026-10-04.cjs',
  'tools/archive/_verify-pu-label.mjs',
  'tools/archive/_verify-pu-label-ui.cjs',
  'tools/archive/_probe-pu-label-index.cjs',
  'tools/archive/_cleanup-pu-label-residue.cjs',
  'tools/archive/_cleanup-pu-label-void-all.cjs',
  'tools/archive/_dbg-supplement-print.cjs',
  'tools/archive/_stage-pu-label-print-granularity.cjs',
]

function splitDiff(text) {
  const lines = text.split('\n')
  const head = []; const hunks = []; let cur = null
  for (const line of lines) {
    if (line.startsWith('@@')) { if (cur) hunks.push(cur); cur = [line]; continue }
    if (cur) cur.push(line); else head.push(line)
  }
  if (cur) hunks.push(cur)
  return { head, hunks }
}

const DRY = process.argv.includes('--dry')
let staged = 0, skipped = 0
for (const [f, pats] of Object.entries(SHARED)) {
  const d = git(['diff', '--', f])
  if (!d.trim()) { console.log(`- ${f}: 无改动,跳过`); continue }
  const { head, hunks } = splitDiff(d)
  const keep = []
  for (const h of hunks) {
    const body = h.join('\n')
    const hit = pats.find((re) => re.test(body))
    const added = h.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1).trim()).filter(Boolean)
    console.log(`  ${hit ? '[本任务]' : '[其它任务]'} ${path.basename(f)} ${h[0].slice(0, 30)} | ${JSON.stringify(added.slice(0, 1))}`)
    if (hit) { keep.push(h); staged++ } else skipped++
  }
  if (DRY || !keep.length) continue
  // 每个 hunk 末尾是 split 留下的空串,拼接前必须掐掉(否则与下一个 @@ 粘行 → git apply 报 patch does not apply)
  const patch = head.join('\n') + '\n' + keep.map((h) => h.join('\n').replace(/\n+$/, '')).join('\n') + '\n'
  const tmp = path.join(os.tmpdir(), 'stage-' + path.basename(f) + '.patch')
  fs.writeFileSync(tmp, patch, 'utf8')
  try {
    git(['apply', '--cached', '--whitespace=nowarn', tmp])
    console.log(`+ ${f}: 暂存 ${keep.length} 个 hunk`)
  } catch (e) {
    const detail = [e.stderr, e.stdout, e.message].map((x) => (x ? x.toString() : '')).join('\n').trim()
    console.error(`✗ ${f}: git apply --cached 失败\n${detail.slice(0, 1200)}`)
    fs.writeFileSync(path.join(__dirname, '_stage-last.patch'), patch, 'utf8')
    process.exit(1)
  } finally { fs.unlinkSync(tmp) }
}

if (DRY) { console.log(`\n[DRY] 本任务 hunk ${staged} / 其它任务 hunk ${skipped}(未暂存)`); process.exit(0) }

for (const f of MINE_ONLY) {
  try { git(['add', '--', f]); console.log(`+ ${f}: 整文件暂存`) }
  catch (e) { console.error(`✗ ${f}: git add 失败 ${String(e.message).slice(0, 200)}`); process.exit(1) }
}
// db-migrations.txt:确认工作区里**只有本任务块**才整文件暂存(另一任务也往里追加时改用手工块切分)
const migDiff = git(['diff', '--', 'tools/db-migrations.txt'])
const migLines = migDiff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
const foreign = migLines.filter((l) => /qc-|特采|tcin|calc|金额/.test(l) && !/pu-label/.test(l))
if (!migLines.length) console.log('- tools/db-migrations.txt:无改动')
else if (foreign.length) console.error(`✗ tools/db-migrations.txt 里混进了别的任务的块(${foreign.length} 行),**未暂存**,请手工切块后再提交`)
else { git(['add', '--', 'tools/db-migrations.txt']); console.log('+ tools/db-migrations.txt:只有本任务块,整文件暂存') }

console.log('\n完成;核对:git diff --cached --stat')
