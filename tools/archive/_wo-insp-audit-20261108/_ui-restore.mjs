/**
 * _ui-restore.mjs —— ego 浏览器点完「提交审批 → 审批通过 → 弃审」之后的清场工具
 *
 * 两步:
 *   1) 点之前:`node _ui-restore.mjs save --panel=QC_PROC_INSP --doc=ZC-2026-10-0126`
 *      → 落 `evidence/ui/<panel>-<doc>-pre.json`(头行/明细/状态行/流程链/审批&消息最大 id 的整行快照)
 *   2) 点之后:`node _ui-restore.mjs restore --panel=QC_PROC_INSP --doc=ZC-2026-10-0126`
 *      → 删本轮自动生成的下游测试单、恢复流程链、头/明细/状态行整行还原、删本轮审批留痕与消息,
 *        并复核「状态回草稿 + 头行全列与测前一致 + 无残留」。
 *
 * 只写测试账套 HSDZ_MES_TEST(openTestDb + DB_NAME() 双闸门)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { openTestDb, saveJson, EVIDENCE, S } from './_lib.mjs'
import { panelCfg, snapshot, newDownstream, cleanupAndRestore, docStatus, rowByKey } from './_doc-lib.mjs'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const eq = argv.find((x) => x.startsWith('--' + n + '='))
  if (eq) return eq.slice(n.length + 3)
  const i = argv.indexOf('--' + n)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const MODE = argv[0]
const PANEL = arg('panel')
const DOC = arg('doc')
if (!['save', 'restore'].includes(MODE) || !PANEL || !DOC) {
  console.error('用法: node _ui-restore.mjs save|restore --panel=<CODE> --doc=<单号>')
  process.exit(2)
}
const P = panelCfg(PANEL)
if (!P) { console.error('未知面板 ' + PANEL); process.exit(2) }
const DIR = path.join(EVIDENCE, 'ui')
const FILE = path.join(DIR, `${PANEL}-${DOC}-pre.json`)

/** Date 走类型标记,JSON 往返后仍是 Date(还原逐列 diff 需要保真)。
 *  ⚠ 必须用 `this[k]` 取原值:JSON.stringify 先调 Date.toJSON 变成 ISO 串,replacer 收到的已是 string。 */
function replacer(k, v) {
  const raw = this[k]
  return raw instanceof Date ? { __date: raw.toISOString() } : v
}
const reviver = (k, v) => (v && typeof v === 'object' && typeof v.__date === 'string' ? new Date(v.__date) : v)

const db = await openTestDb()
try {
  const dbName = S((await db.one('SELECT DB_NAME() AS db')).db)
  if (dbName !== 'HSDZ_MES_TEST') throw new Error('拒绝:当前库 ' + dbName)
  if (MODE === 'save') {
    const snap = await snapshot(db, P, DOC)
    if (!snap.head) throw new Error(`单据不存在:${PANEL}/${DOC}`)
    const st = await docStatus(db, PANEL, DOC)
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(snap, replacer, 1) + '\n', 'utf8')
    console.log(`[save] ${PANEL}/${DOC} 状态=${st.status} 头行=1 明细=${snap.detail.length} 流程链=${snap.links.length} 审批maxId=${snap.maxAppr}`)
    console.log('[save] ' + FILE)
  } else {
    if (!fs.existsSync(FILE)) throw new Error('前置快照不存在:' + FILE)
    const pre = JSON.parse(fs.readFileSync(FILE, 'utf8'), reviver)
    const downs = await newDownstream(db, P, DOC, pre)
    const rep = await cleanupAndRestore(db, P, DOC, pre, downs)
    const rows = Number(await (async () => (await db.one('SELECT COUNT(*) n FROM yj_doc_status WHERE panel_code=\'' + PANEL + '\' AND doc_no=\'' + DOC + '\'')).n)())
    console.log('[restore] 下游测试单 =', JSON.stringify(downs), JSON.stringify(rep.downstreamDeleted))
    console.log('[restore] 复核:', JSON.stringify(rep.residue))
    const st = await docStatus(db, PANEL, DOC)
    const head = await rowByKey(db, P.head, '单据编号', DOC)
    const ok = st.status === '草稿' && rep.residue.headDiff.length === 0 && rep.residue.approvalLeft === 0
      && Object.values(rep.residue.downstreamLeft).every((n) => n === 0)
    console.log(ok ? 'RESTORE: PASS' : 'RESTORE: FAIL', JSON.stringify({ status: st.status, statusRows: rows, headCols: Object.keys(head || {}).length }))
    await saveJson(path.join(DIR, `${PANEL}-${DOC}-restore-${Date.now()}.json`), rep)
    if (!ok) process.exit(3)
  }
} finally {
  await db.close()
}
