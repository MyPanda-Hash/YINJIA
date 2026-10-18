/**
 * 从**服务器**拉取「生产面板」单据数据 → CSV,随仓库推送到云端(2026-10-18)
 *
 * 【用户口径】「拉取GitHub上的生产面板的单据的数据」——仓库里其实没有生产单据数据
 *   (只有 db/scjl-data-20261016.csv 的 7 行取证样本 + db/HSDZ_MES.sql 的建表与种子数据,
 *    两者都不含 scjl/plang 业务数据),用户确认改走**服务器**拉全量。
 *
 * 【数据源】服务器应用接口(不是直连库:服务器只开 3389/8090,1433 未对外开放):
 *   POST {base}/api/auth/login  → token
 *   POST {base}/api/px/queryFormDataList {panelCode, pageNo, pageSize} → { totalSize, list[] }
 *   list[i] = { 单据编号, 编号, 单据状态, saved, detail:{items:[...]} }
 *   ⇒ 只读:全部是查询请求,不写服务器任何数据。
 *
 * 【对象】「生产制造 / 生产过程」10 张单据面板(与系统菜单一致)。
 *
 * 【展平规则】一行 = 一个明细行;单据没有明细时退化为一行(单据级字段照填)。
 *
 * 【安全】服务器是**生产环境**:脚本只发查询请求;账号口令走环境变量,不写进仓库。
 *   导出内容含工单号/产品/工序/报工人(业务事实数据,同 db/emp-data 的口径保留),无联系方式。
 *
 * 用法(仓库根):
 *   $env:SRV_BASE='http://36.140.66.163:8090'; $env:SRV_USER='admin'; $env:SRV_PASS='***'
 *   node tools/archive/_prod-export-20261018/_export-prod-csv.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..', '..')
const BASE = process.env.SRV_BASE || 'http://36.140.66.163:8090'
const USER = process.env.SRV_USER || ''
const PASS = process.env.SRV_PASS || ''
const PAGE = 500
const OUTDIR = path.join(ROOT, 'db', 'production-data-20261018')

const PANELS = [
  ['WO_REPORT', '工序报工单'],
  ['WO_REPORT_LIST', '报工记录'],
  ['WO_COMPLETION_LIST', '完工明细'],
  ['PROD_ABN', '生产异常处理单'],
  ['DAY_REPORT', '生产日报表'],
  ['FEED_CONFIRM', '投料确认单'],
  ['MIX_RECORD', '物料混合记录'],
  ['GRAN_RECORD', '造粒记录'],
  ['WH_RECORD', '无黑处理登记'],
  ['PACK_CONFIRM', '封箱确认'],
]

if (!USER || !PASS) {
  console.log('[FAIL] 请先设 SRV_USER / SRV_PASS 环境变量(口令不进仓库)')
  process.exit(1)
}

const post = async (url, body, token) => {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
  return r.json()
}

/* ── 登录 ── */
const lj = await post(BASE + '/api/auth/login', { userName: USER, password: PASS, factory: 'YJ' })
if (lj.code !== 200 || !lj.data?.token) {
  console.log('[FAIL] 登录失败: ' + JSON.stringify(lj).slice(0, 200))
  process.exit(1)
}
const token = lj.data.token
console.log('登录成功,开始拉取 ' + PANELS.length + ' 张面板')

/* ── CSV 工具 ── */
const esc = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
const toCsv = (headers, rows) =>
  '\uFEFF' + headers.map(esc).join(',') + '\r\n' + rows.map((r) => headers.map((h) => esc(r[h])).join(',')).join('\r\n') + '\r\n'

const summary = []
mkdirSync(OUTDIR, { recursive: true })

for (const [code, name] of PANELS) {
  const rows = []
  const headKeys = new Set()
  const detailKeys = new Set()
  let pageNo = 1, total = 0
  for (;;) {
    const j = await post(BASE + '/api/px/queryFormDataList', { panelCode: code, condition: {}, pageNo, pageSize: PAGE }, token)
    if (j.code !== 200) throw new Error(code + ' 查询失败: ' + j.message)
    total = j.data.totalSize
    const list = j.data.list || []
    for (const doc of list) {
      // ⚠ detail 的键**不固定**:普通单据是 detail.items,而 archive 模式的面板用
      //   yj_panel.detail_key 命名(实测 PROD_ABN → detail.prod_abn)。
      //   第一版只读 detail.items ⇒ PROD_ABN 导出成了面板元数据(编号/状态/单据状态)。
      //   这里把所有数组型子键都摊平,兼容两种形态。
      const detailObj = doc.detail || {}
      let items = []
      for (const v of Object.values(detailObj)) {
        if (Array.isArray(v)) items = items.concat(v)
      }
      // archive 模式的顶层还带一份**面板元数据**(编号=面板名如「生产异常处理单」、状态=启用),
      // 它不是单据字段 —— 判定:顶层「编号」与明细「单据编号」不一致 ⇒ 整行是元数据,
      // 把 编号/状态/单据状态 三个噪音列丢掉(普通单据三者都是真值,原样保留)。
      const realNo = items.length ? items[0]['单据编号'] : null
      const metaHead = !!(realNo && doc['编号'] && doc['编号'] !== realNo)
      const head = {}
      for (const [k, v] of Object.entries(doc)) {
        if (k === 'detail') continue
        if (metaHead && (k === '编号' || k === '状态' || k === '单据状态')) continue
        head[k] = v
        headKeys.add(k)
      }
      if (items.length === 0) {
        rows.push({ ...head })
      } else {
        for (const it of items) {
          const merged = { ...head }
          for (const [k, v] of Object.entries(it)) {
            if (k === 'id') continue
            // 单据级已有的键(如 单据编号)不覆盖
            if (!(k in merged) || merged[k] === null || merged[k] === '') merged[k] = v
            detailKeys.add(k)
          }
          rows.push(merged)
        }
      }
    }
    if (pageNo * PAGE >= total || list.length === 0) break
    pageNo++
  }
  // 列顺序:单据级在前,明细级在后(去掉与单据级重名的)
  const headCols = [...headKeys]
  const detCols = [...detailKeys].filter((k) => !headKeys.has(k))
  const cols = [...headCols, ...detCols]
  const file = path.join(OUTDIR, `${name}-${code}.csv`)
  writeFileSync(file, toCsv(cols, rows), 'utf8')
  const kb = (Buffer.byteLength(toCsv(cols, rows)) / 1024).toFixed(1)
  console.log(`  ${name}(${code}): 单据 ${total} 张 → ${rows.length} 行 / ${cols.length} 列 / ${kb} KB`)
  summary.push({ panel: code, name, documents: total, rows: rows.length, columns: cols.length, kb: Number(kb), file: path.basename(file) })
}

const totalDocs = summary.reduce((a, s) => a + s.documents, 0)
const totalRows = summary.reduce((a, s) => a + s.rows, 0)
writeFileSync(path.join(OUTDIR, '_export-summary.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: BASE,
  factory: 'YJ',
  panels: summary,
  totals: { documents: totalDocs, rows: totalRows },
}, null, 2), 'utf8')

console.log(`\n[OK] 10 张面板 / 单据 ${totalDocs} 张 / 展平 ${totalRows} 行 → ${OUTDIR}`)
