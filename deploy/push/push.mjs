#!/usr/bin/env node
// deploy/push/push.mjs — MES → 金蝶沙箱 增量推送(采购入库 + 销售出库)
// 与 deploy/sync-core.mjs 同架构、同 EXTRA 映射,方向反转(读 MES → 写金蝶)
// 所有字段全量推送(与下拉同步的 EXTRA 一一对应),沙箱专用
// 用法:
//   node push.mjs                    # 单次推送
//   node push.mjs --watch            # 5 分钟定时增量
//   node push.mjs --dry-run          # 演练
//   node push.mjs --probe            # 仅探测连通
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PARENT = join(HERE, '..'); // deploy/
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const PROBE = args.has('--probe');
const WATCH = args.has('--watch');
const WATCH_MS = 5 * 60 * 1000;
const INCLUDE_SYNCED = args.has('--include-synced'); // 推含从金蝶拉来的单(CGRK/XSCK 前缀)

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

const N_PUSH = 'mes-push';

// ══════════════════════════════════════════════════════════
// 反向映射:MES 中文列 → 金蝶 API 键(与 EXTRA 完全一一对应,全量)
// ══════════════════════════════════════════════════════════
function revMap(row, entries) {
  const out = {};
  for (const e of entries || []) {
    const v = row[e.c];
    if (v === undefined || v === null || v === '') continue;
    if (e.a.includes('.')) continue; // 子实体首行(联系人等)不适用于单据体
    const s = String(v);
    // 类型推断(与金蝶 proto 定义对齐)
    if (/^is_/.test(e.a)) { out[e.a] = s.toLowerCase() === 'true' || s === '1' ? 1 : 0; continue; }
    if (/(qty|amount|rate|price|cost|coefficient|period|^seq$|count|discount|cess)/i.test(e.a) && /^-?\d+\.?\d*$/.test(s)) {
      out[e.a] = Number(s); continue;
    }
    out[e.a] = s;
  }
  return out;
}

// ══════════════════════════════════════════════════════════
// DOCS 注册表(与 sync-core 的 DOCS 对应,方向反转)
// ══════════════════════════════════════════════════════════
const PUSH_DOCS = [
  {
    code: 'PUR_IN', label: '采购入库',
    headTable: 'bd_purchase_in', lineTable: 'bl_purchase_in',
    apiPath: '/jdy/v2/scm/pur_inbound',
    extraKey: 'PURCHASE_IN',
    // 头:核心手工字段(EXTRA 覆盖不到的原生 MES 列)
    headBase: (h) => ({
      bill_no: String(h.单据编号 || ''),
      bill_date: String(h.单据日期 || '').slice(0, 10),
      trans_type: '2',
      supplier_number: String(h.供应商编码 || ''),
      remark: String(h.备注 || ''),
    }),
    // 行:核心手工字段
    lineBase: (l) => ({
      material_number: String(l.存货编码 || ''),
      qty: Number(l.实收数量) || 0,
      price: Number(l.单价) || 0,
      cess: Number(l['税率%']) || 0,
      stock_number: String(l.仓库编码 || ''),
      batch_no: String(l.批号 || ''),
    }),
    // 基础资料引用(推单前确保存在)
    basics: (h, lines) => {
      const out = [{ type: 'supplier', number: h.供应商编码, name: h.供应商 }];
      for (const l of lines) {
        if (l.存货编码) out.push({ type: 'material', number: l.存货编码, name: l.存货名称, model: l.规格型号 || '' });
        if (l.仓库编码) out.push({ type: 'store', number: l.仓库编码, name: l.仓库 });
      }
      return out;
    },
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
      qty: Number(l.数量) || 0,
      price: Number(l.售价 || 0),
      cess: Number(l['税率%']) || 0,
      stock_number: String(l.仓库编码 || ''),
      batch_no: String(l.批号 || ''),
    }),
    basics: (h, lines) => {
      const out = [{ type: 'customer', number: h.客户编码, name: h.客户 }];
      for (const l of lines) {
        if (l.存货编码) out.push({ type: 'material', number: l.存货编码, name: l.存货名称, model: l.规格型号 || '' });
        if (l.仓库编码) out.push({ type: 'store', number: l.仓库编码, name: l.仓库 });
      }
      return out;
    },
  },
];

// ══════════════════════════════════════════════════════════
// 基础资料:沙箱缓存 + 确保存在(自动创建)
// ══════════════════════════════════════════════════════════
const cache = { supplier: new Set(), customer: new Set(), material: new Set(), store: new Set(), emp: new Set(), dept: new Set() };
const API_PATH = { supplier: '/jdy/v2/bd/supplier', customer: '/jdy/v2/bd/customer', material: '/jdy/v2/bd/material', store: '/jdy/v2/bd/store', emp: '/jdy/v2/bd/emp', dept: '/jdy/v2/bd/department' };

async function loadCache(token) {
  for (const [key, path] of Object.entries(API_PATH)) {
    try {
      let page = 1;
      for (;;) {
        const r = await kingdeeGet(cfg.kingdee, token, path, { page: String(page), page_size: '200' });
        for (const row of (r.rows || [])) cache[key].add(String(row.number));
        if (!r.rows || r.rows.length < 200 || page > 50) break;
        page++;
      }
    } catch { /* 部分接口可能不存在 */ }
  }
  log(`沙箱缓存: 供${cache.supplier.size} 客${cache.customer.size} 商${cache.material.size} 仓${cache.store.size} 员${cache.emp.size} 部${cache.dept.size}`);
}

let unitId = null;
async function getUnitId(token) {
  if (unitId) return unitId;
  try {
    const r = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/measure_unit', { page: '1', page_size: '5' });
    const u = (r.rows || []).find((x) => x.number === '个') || (r.rows || [])[0];
    if (u) unitId = u.id;
  } catch {}
  return unitId;
}

async function ensure(token, type, number, name, extra = {}) {
  if (!number) return true;
  if (cache[type].has(String(number))) return true;
  let body = { number: String(number), name: String(name || number) };
  if (type === 'material') {
    const uid = await getUnitId(token);
    if (!uid) return false;
    body = { ...body, base_unit_id: uid, purchase_unit_id: uid, sale_unit_id: uid, store_unit_id: uid };
    if (extra.model) body.model = String(extra.model);
  }
  let r = await kingdeePost(cfg.kingdee, token, API_PATH[type], {}, body);
  if (!r.ok && /已存在/.test(String(r.error || '')) && type === 'material') {
    // 同名不同码 → 名称加编码消歧
    r = await kingdeePost(cfg.kingdee, token, API_PATH[type], {}, { ...body, name: `${name}(${number})` });
  }
  if (r.ok || /已存在/.test(String(r.error || ''))) { cache[type].add(String(number)); return true; }
  log(`  ✗ 创建${type}失败: ${number} → ${String(r.error || '').slice(0, 80)}`);
  return false;
}

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

    await loadCache(token);

    // ── 防重复:拉取金蝶已有的单号集合 ──
    const existingNos = new Set();
    for (const doc of PUSH_DOCS) {
      try {
        let page = 1;
        for (;;) {
          const r = await kingdeeGet(cfg.kingdee, token, doc.apiPath, { page: String(page), page_size: '200' });
          for (const row of (r.rows || [])) existingNos.add(doc.code + '|' + String(row.bill_no || ''));
          if (!r.rows || r.rows.length < 200 || page > 20) break;
          page++;
        }
      } catch { /* 忽略 */ }
    }
    log(`金蝶已有单号: ${existingNos.size} 个(防重复)`);

    let totalOk = 0, totalFail = 0, totalSkip = 0;

    for (const doc of PUSH_DOCS) {
      // 增量:asp_user1 ≠ 'mes-push' 且 单据状态 = 已审核(草稿不上传)
      const exclude = INCLUDE_SYNCED ? '' : `AND t.单据编号 NOT LIKE '${doc.code === 'PUR_IN' ? 'CGRK' : 'XSCK'}-%'`;
      const heads = (await pool.request().query(`
        SELECT * FROM dbo.[${doc.headTable}] t
        WHERE ISNULL(t.asp_cancel,'N')<>'Y' AND ISNULL(t.asp_user1,'')<>'${N_PUSH}'
          AND t.单据状态 = N'已审核'
          AND t.单据编号 NOT LIKE 'PI-%' AND t.单据编号 NOT LIKE 'TEST-%' ${exclude}
        ORDER BY t.asp_time1 DESC`)).recordset;
      if (!heads.length) { log(`【${doc.label}】无待推送`); continue; }
      log(`\n【${doc.label}】待推送 ${heads.length} 单`);

      for (const h of heads) {
        const no = String(h.单据编号).replace(/'/g, "''");

        // 防重复:金蝶已有该单号 → 跳过并标记
        if (existingNos.has(doc.code + '|' + String(h.单据编号))) {
          log(`  ⏭ ${h.单据编号}: 金蝶已存在,跳过`);
          await pool.request().query(`UPDATE dbo.[${doc.headTable}] SET asp_user1='${N_PUSH}' WHERE 单据编号='${no}'`);
          totalSkip++; continue;
        }
        // MES 备注里已有金蝶单号标记 → 跳过
        if (/\[金蝶:[^\]]+\]/.test(String(h.备注 || ''))) {
          log(`  ⏭ ${h.单据编号}: 已推送过(备注有标记),跳过`);
          await pool.request().query(`UPDATE dbo.[${doc.headTable}] SET asp_user1='${N_PUSH}' WHERE 单据编号='${no}'`);
          totalSkip++; continue;
        }

        const lines = (await pool.request().query(`
          SELECT * FROM dbo.[${doc.lineTable}] WHERE 单据编号='${no}' AND ISNULL(asp_cancel,'N')<>'Y'`)).recordset;
        if (!lines.length) { log(`  ⏭ ${h.单据编号}: 无明细行,跳过`); totalSkip++; continue; }

        // 确保基础资料
        let allOk = true;
        for (const b of doc.basics(h, lines)) {
          if (!await ensure(token, b.type, b.number, b.name, { model: b.model })) { allOk = false; break; }
        }
        if (!allOk) { log(`  ✗ ${h.单据编号}: 基础资料无法创建`); totalFail++; continue; }

        // 全量映射:头(bill_no 确保在) + EXTRA 全量 + 行
        const head = { bill_no: String(h.单据编号 || ''), ...revMap(h, EXTRA[doc.extraKey]), ...doc.headBase(h) };
        head.bill_no = String(h.单据编号 || ''); // 再次确保降级不丢
        head.material_entity = lines.map((l) => ({ ...revMap(l, EXTRA_LINES[doc.extraKey]), ...doc.lineBase(l) }));

        log(`  → ${h.单据编号} (${lines.length} 行, 头${Object.keys(head).length - 1}键)`);

        if (DRY_RUN) { log(`    [dry-run] bill_no=${head.bill_no}`); totalOk++; continue; }

        let r = await kingdeePost(cfg.kingdee, token, doc.apiPath, {}, head);
        // 渐进降级
        if (!r.ok && /源单未审核|源单.*删除/.test(String(r.error || ''))) {
          log(`    [降1] 去 src_* 引用`);
          const noSrc = { ...head };
          for (const k of Object.keys(noSrc)) if (/^src_/.test(k)) delete noSrc[k];
          for (const ln of (noSrc.material_entity || [])) for (const k of Object.keys(ln)) if (/^src_/.test(k)) delete ln[k];
          r = await kingdeePost(cfg.kingdee, token, doc.apiPath, {}, noSrc);
        }
        if (!r.ok && /invalid value|proto/.test(String(r.error || ''))) {
          log(`    [降2] 类型冲突,退核心(保留 bill_no)`);
          const basicHead = { bill_no: String(h.单据编号 || ''), ...doc.headBase(h) };
          basicHead.bill_no = String(h.单据编号 || '');
          basicHead.material_entity = lines.map((l) => doc.lineBase(l));
          r = await kingdeePost(cfg.kingdee, token, doc.apiPath, {}, basicHead);
        }
        if (!r.ok && /数据不存在/.test(String(r.error || ''))) {
          log(`    [降3] 基础资料不存在,退核心(保留 bill_no)`);
          const basicHead = { bill_no: String(h.单据编号 || ''), ...doc.headBase(h) };
          basicHead.bill_no = String(h.单据编号 || '');
          basicHead.material_entity = lines.map((l) => doc.lineBase(l));
          r = await kingdeePost(cfg.kingdee, token, doc.apiPath, {}, basicHead);
        }

        if (r.ok) {
          const kn = String(Object.values(r.data?.id_number_map || {})[0] || '');
          await pool.request().query(`
            UPDATE dbo.[${doc.headTable}] SET asp_user1='${N_PUSH}' ${kn ? `, 备注=ISNULL(备注,'')+N' [金蝶:${kn}]'` : ''}
            WHERE 单据编号='${no}'`);
          existingNos.add(doc.code + '|' + String(kn || h.单据编号));
          log(`    ✓ → ${kn || '(金蝶自动编号)'}`);
          totalOk++;
        } else {
          log(`    ✗ ${String(r.error || '').slice(0, 120)}`);
          totalFail++;
        }
      }
    }
    log(`\n=== 完成: 成功 ${totalOk}, 失败 ${totalFail}, 跳过 ${totalSkip} ===`);
  } catch (e) { log(`FATAL: ${e.message}`); }
  running = false;
}

await runOnce();
if (WATCH) {
  log(`[watch] 定时模式启动,间隔 ${WATCH_MS / 60000} 分钟`);
  setInterval(() => {
    // 每轮重置缓存(检测新建基础资料)
    for (const k of Object.keys(cache)) cache[k].clear();
    unitId = null;
    runOnce();
  }, WATCH_MS);
} else {
  await pool.close();
}
