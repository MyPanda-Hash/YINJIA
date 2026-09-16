#!/usr/bin/env node
// deploy/push/push.mjs — MES → 金蝶沙箱 增量推送(采购入库 + 销售出库)
// 与 deploy/sync-core.mjs 同架构、同 EXTRA 映射,方向反转(读 MES → 写金蝶)
//
// 增量规则(与同步脚本对称):
//   ① 变更检测:asp_time2(MES 引擎每次修改自动写) > lastPushTime → 有变化才推
//   ② 新增:    金蝶无该 bill_no → POST 创建
//   ③ 更新:    金蝶已有该 bill_no → POST 带 id 更新
//   ④ 时间窗:  最近 31 天有变化的(与同步的 windowDays 对称)
//   ⑤ 状态:    只推 单据Status='已审核'(草稿不上传)
//   ⑥ 全量字段:EXTRA + EXTRA_LINES 反向映射,所有字段全量推送
//   ⑦ 推送指纹:推完写 推送指纹 列,下轮比对跳过无变化的
//
// 用法:
//   node push.mjs                    # 单次增量推送
//   node push.mjs --watch            # 5 分钟定时增量
//   node push.mjs --dry-run          # 演练(不写库不推金蝶)
//   node push.mjs --probe            # 仅探测连通
//   node push.mjs --full             # 强制全量重推(忽略时间窗和指纹)
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const PARENT = join(HERE, '..'); // deploy/
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const PROBE = args.has('--probe');
const WATCH = args.has('--watch');
const FULL = args.has('--full'); // 强制全量(忽略指纹)
const WATCH_MS = 5 * 60 * 1000;
const WINDOW_DAYS = 31; // 时间窗(与同步的 windowDays 对称)
const N_PUSH = 'mes-push';
const STATE_FILE = join(HERE, 'push-state.json'); // 持久化 lastPushTime

const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));

// ── 日志 ──
const LOG_DIR = join(HERE, 'logs'); if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
const LOG = join(LOG_DIR, `push-${new Date().toISOString().slice(0, 10)}.log`);
const log = (m) => { const l = `[${new Date().toLocaleString('zh-CN', { hour12: false })}] ${m}`; console.log(l); appendFileSync(LOG, l + '\n', 'utf8'); };

// ── 依赖(复用 deploy/ 根,不改原文件) ──
const { fetchAppToken, kingdeeGet, kingdeePost } = await import(pathToFileURL(join(PARENT, 'kingdee-client.mjs')).href);
const { EXTRA, EXTRA_LINES } = await import(pathToFileURL(join(PARENT, 'kingdee-extra-fields.mjs')).href);
const mssql = (await import('mssql')).default;
const pool = new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433,
  database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
await pool.connect();

// ── 推送状态(持久化 lastPushTime + 每张单的推送指纹) ──
let state = { lastPushTime: 0, fingerprints: {} }; // fingerprints: { "PUR_IN|CGRK-xxx": "sha256..." }
if (existsSync(STATE_FILE)) {
  try { state = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { /* 损坏则重置 */ }
}
function saveState() { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8'); }

// ══════════════════════════════════════════════════════════
// 指纹:MES 头+行关键字段哈希(与同步的 fingerprintOf 对称)
// ══════════════════════════════════════════════════════════
function pushFingerprint(h, lines) {
  const headPart = [h.单据编号, h.单据日期, h.单据状态, h.供应商 || h.客户, h.备注, h.金额].map(v => v === undefined || v === null ? '' : String(v)).join('|');
  const linePart = lines.map(l => [l.存货编码, l.实收数量 || l.数量, l.单价 || l.售价, l.批号].map(v => v === undefined || v === null ? '' : String(v)).join('|')).join('||');
  return createHash('sha256').update(headPart + '##' + linePart).digest('hex').slice(0, 32);
}

// ══════════════════════════════════════════════════════════
// 反向映射:MES 中文列 → 金蝶 API 键(EXTRA 全量)
// ══════════════════════════════════════════════════════════
function revMap(row, entries) {
  const out = {};
  for (const e of entries || []) {
    const v = row[e.c];
    if (v === undefined || v === null || v === '') continue;
    if (e.a.includes('.')) continue;
    const s = String(v);
    if (/^is_/.test(e.a)) { out[e.a] = s.toLowerCase() === 'true' || s === '1' ? 1 : 0; continue; }
    if (/(qty|amount|rate|price|cost|coefficient|period|^seq$|count|discount|cess)/i.test(e.a) && /^-?\d+\.?\d*$/.test(s)) {
      out[e.a] = Number(s); continue;
    }
    out[e.a] = s;
  }
  return out;
}

// ══════════════════════════════════════════════════════════
// DOCS 注册表(只推单据,不推基础资料——沙箱已有)
// ══════════════════════════════════════════════════════════
const PUSH_DOCS = [
  {
    code: 'PUR_IN', label: '采购入库',
    headTable: 'bd_purchase_in', lineTable: 'bl_purchase_in',
    apiPath: '/jdy/v2/scm/pur_inbound',
    extraKey: 'PURCHASE_IN',
    headBase: (h) => ({
      bill_no: String(h.单据编号 || ''),
      bill_date: String(h.单据日期 || '').slice(0, 10),
      trans_type: '2',
      supplier_number: String(h.供应商编码 || ''),
      remark: String(h.备注 || ''),
    }),
    lineBase: (l) => ({
      material_number: String(l.存货编码 || ''),
      material_model: String(l.规格型号 || ''),
      qty: Number(l.实收数量) || 0,
      price: Number(l.单价) || 0,
      cess: Number(l['税率%']) || 0,
      stock_number: String(l.仓库编码 || ''),
      batch_no: String(l.批号 || ''),
    }),
  },
  {
    code: 'SALE_OUT', label: '销售出库',
    headTable: 'bd_sale_out', lineTable: 'bl_sale_out',
    apiPath: '/jdy/v2/scm/sal_out_bound',
    extraKey: 'SALE_OUT',
    headBase: (h) => ({
      bill_no: String(h.单据编号 || ''),
      bill_date: String(h.单据日期 || '').slice(0, 10),
      trans_type: '2',
      customer_number: String(h.客户编码 || ''),
      remark: String(h.备注 || ''),
    }),
    lineBase: (l) => ({
      material_number: String(l.存货编码 || ''),
      material_model: String(l.规格型号 || ''),
      qty: Number(l.数量) || 0,
      price: Number(l.售价 || 0),
      cess: Number(l['税率%']) || 0,
      stock_number: String(l.仓库编码 || ''),
      batch_no: String(l.批号 || ''),
    }),
  },
];

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════
let running = false;
async function runOnce() {
  if (running) return; running = true;
  try {
    const { token } = await fetchAppToken(cfg.kingdee);
    log(`沙箱连通 ✓ (clientId=${cfg.kingdee.clientId})`);
    if (PROBE) { log('探测模式'); return; }

    // ── 拉金蝶已有的单据(bill_no → id 映射,用于更新) ──
    const kingdeeDocs = new Map(); // "PUR_IN|bill_no" → { id, bill_no }
    for (const doc of PUSH_DOCS) {
      try {
        let page = 1;
        for (;;) {
          const r = await kingdeeGet(cfg.kingdee, token, doc.apiPath, { page: String(page), page_size: '200' });
          for (const row of (r.rows || [])) kingdeeDocs.set(doc.code + '|' + String(row.bill_no || ''), { id: row.id, bill_no: row.bill_no });
          if (!r.rows || r.rows.length < 200 || page > 20) break;
          page++;
        }
      } catch { /* 忽略 */ }
    }
    log(`金蝶已有单据: ${kingdeeDocs.size} 张`);

    let totalNew = 0, totalUpd = 0, totalSkip = 0, totalFail = 0;
    const now = Date.now();
    const windowMs = WINDOW_DAYS * 86400000;

    for (const doc of PUSH_DOCS) {
      // ── 增量查询:最近 31 天有变化的(asp_time2 > now - windowMs)且已审核 ──
      // asp_time2 = MES 引擎每次保存/修改自动更新(GETDATE())
      // FULL 模式忽略时间窗和指纹,全量推
      const windowFilter = FULL ? '' : `AND (t.asp_time2 IS NOT NULL AND t.asp_time2 > DATEADD(second, -${Math.floor(windowMs / 1000)}, GETDATE()))`;
      const heads = (await pool.request().query(`
        SELECT * FROM dbo.[${doc.headTable}] t
        WHERE ISNULL(t.asp_cancel,'N')<>'Y'
          AND t.单据状态 = N'已审核'
          AND t.单据编号 NOT LIKE 'PI-%' AND t.单据编号 NOT LIKE 'TEST-%'
          ${windowFilter}
        ORDER BY t.asp_time2 DESC`)).recordset;
      if (!heads.length) { log(`【${doc.label}】近${WINDOW_DAYS}天无变化`); continue; }

      for (const h of heads) {
        const no = String(h.单据编号).replace(/'/g, "''");
        const fpKey = doc.code + '|' + String(h.单据编号);

        const lines = (await pool.request().query(`
          SELECT * FROM dbo.[${doc.lineTable}] WHERE 单据编号='${no}' AND ISNULL(asp_cancel,'N')<>'Y'`)).recordset;
        if (!lines.length) { totalSkip++; continue; }

        // ── 指纹比对(与同步的指纹跳过对称) ──
        const fp = pushFingerprint(h, lines);
        if (!FULL && state.fingerprints[fpKey] === fp) {
          totalSkip++; continue; // 无变化,跳过
        }

        // ── 全量映射 ──
        const head = { bill_no: String(h.单据编号 || ''), ...revMap(h, EXTRA[doc.extraKey]), ...doc.headBase(h) };
        head.bill_no = String(h.单据编号 || '');
        head.material_entity = lines.map((l) => ({ ...revMap(l, EXTRA_LINES[doc.extraKey]), ...doc.lineBase(l) }));

        // ── 判断新增还是更新 ──
        const existing = kingdeeDocs.get(fpKey);
        const isUpdate = !!existing;
        if (isUpdate) head.id = existing.id; // 金蝶已有 → 带 id 更新

        log(`  ${isUpdate ? '↑' : '+'} ${h.单据编号} (${lines.length} 行, 头${Object.keys(head).length - 1}键) ${isUpdate ? '[更新]' : '[新增]'}`);

        if (DRY_RUN) { log(`    [dry-run] ${isUpdate ? '更新 id=' + existing.id : '新建'}`); isUpdate ? totalUpd++ : totalNew++; continue; }

        // ── 推送(POST:金蝶 save API 创建/更新共用) ──
        let r = await kingdeePost(cfg.kingdee, token, doc.apiPath, {}, head);

        // 渐进降级
        if (!r.ok && /源单未审核|源单.*删除/.test(String(r.error || ''))) {
          const stripped = { ...head };
          for (const k of Object.keys(stripped)) if (/^src_/.test(k)) delete stripped[k];
          for (const ln of (stripped.material_entity || [])) for (const k of Object.keys(ln)) if (/^src_/.test(k)) delete ln[k];
          r = await kingdeePost(cfg.kingdee, token, doc.apiPath, {}, stripped);
        }
        if (!r.ok && /invalid value|proto/.test(String(r.error || ''))) {
          const bh = { id: head.id, bill_no: head.bill_no, ...doc.headBase(h) };
          bh.material_entity = lines.map((l) => doc.lineBase(l));
          r = await kingdeePost(cfg.kingdee, token, doc.apiPath, {}, bh);
        }
        if (!r.ok && /数据不存在/.test(String(r.error || ''))) {
          // 基础资料引用不存在 → 去掉 id 重试新建(可能沙箱单据被删了)
          const bh = { bill_no: head.bill_no, ...doc.headBase(h) };
          bh.material_entity = lines.map((l) => doc.lineBase(l));
          r = await kingdeePost(cfg.kingdee, token, doc.apiPath, {}, bh);
        }

        if (r.ok) {
          const kn = String(Object.values(r.data?.id_number_map || {})[0] || '');
          state.fingerprints[fpKey] = fp; // 写推送指纹(下轮无变化则跳过)
          isUpdate ? totalUpd++ : totalNew++;
          log(`    ✓ ${isUpdate ? '更新' : '新建'}${kn ? ' → ' + kn : ''}`);
        } else {
          totalFail++;
          log(`    ✗ ${String(r.error || '').slice(0, 120)}`);
        }
      }
    }

    // ── 记录本轮推送时间(下轮的增量起点) ──
    state.lastPushTime = now;
    if (!DRY_RUN) saveState();

    log(`\n=== 完成: 新增 ${totalNew}, 更新 ${totalUpd}, 跳过 ${totalSkip}, 失败 ${totalFail} ===`);
  } catch (e) { log(`FATAL: ${e.message}`); }
  running = false;
}

await runOnce();
if (WATCH) {
  log(`[watch] 定时模式启动,间隔 ${WATCH_MS / 60000} 分钟`);
  setInterval(() => runOnce(), WATCH_MS);
} else {
  await pool.close();
}
