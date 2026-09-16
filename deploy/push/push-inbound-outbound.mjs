#!/usr/bin/env node
// push-inbound-outbound.mjs — MES → 金蝶 增量推送(采购入库 + 销售出库)
// 方向:MES 本地新建的单据 → 推送到金蝶云·星辰沙箱
// 增量口径:asp_user1 = 'mes-push' 标记已推送;未标记的 = 待推送
// 推送前自动同步缺失的基础资料(供应商/客户/商品/仓库)到沙箱
// 用法:
//   node push-inbound-outbound.mjs              # 推送(交互确认)
//   node push-inbound-outbound.mjs --yes        # 推送(跳过确认)
//   node push-inbound-outbound.mjs --dry-run    # 演练(不写库不推金蝶)
//   node push-inbound-outbound.mjs --probe      # 仅探测沙箱连通性
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PARENT = join(HERE, '..');
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const PROBE = args.has('--probe');
const SKIP_CONFIRM = args.has('--yes');
const INCLUDE_SYNCED = args.has('--include-synced'); // 推含金蝶同步来的单(推到不同沙箱时用)

const cfgPath = join(HERE, 'config.json');
if (!existsSync(cfgPath)) { console.error('缺少 push/config.json'); process.exit(1); }
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));

// ── 日志 ──
const LOG_DIR = join(HERE, 'logs');
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = join(LOG_DIR, `push-${new Date().toISOString().slice(0, 10)}.log`);
const log = (msg) => {
  const line = `[${new Date().toLocaleString('zh-CN', { hour12: false })}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n', 'utf8');
};

// ── 金蝶客户端 ──
const { fetchAppToken, kingdeeGet, kingdeePost } = await import(pathToFileURL(join(PARENT, 'kingdee-client.mjs')).href);
// EXTRA 反向映射:列名 → API 键(全量推送,含隐藏字段)
const { EXTRA, EXTRA_LINES } = await import(pathToFileURL(join(PARENT, 'kingdee-extra-fields.mjs')).href);

// ── 数据库 ──
const mssql = (await import('mssql')).default;
const pool = new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433,
  database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
await pool.connect();

const N_PUSH_USER = 'mes-push';

// ══ 基础资料缓存(沙箱已有的编码集合) ══
const sandboxCache = { supplier: new Set(), customer: new Set(), material: new Set(), store: new Set() };

async function loadSandboxBasics(token) {
  const tasks = [
    ['supplier', '/jdy/v2/bd/supplier', 200],
    ['customer', '/jdy/v2/bd/customer', 200],
    ['material', '/jdy/v2/bd/material', 200],
    ['store', '/jdy/v2/bd/store', 50],
  ];
  for (const [key, path, pageSize] of tasks) {
    try {
      let page = 1;
      for (;;) {
        const r = await kingdeeGet(cfg.kingdee, token, path, { page: String(page), page_size: String(pageSize) });
        for (const row of (r.rows || [])) sandboxCache[key].add(String(row.number));
        if (!r.rows || r.rows.length < pageSize || page > 50) break;
        page++;
      }
      log(`  沙箱${key}缓存: ${sandboxCache[key].size} 个编码`);
    } catch (e) { log(`  沙箱${key}缓存失败: ${e.message.slice(0, 60)}`); }
  }
}

/** 确保基础资料存在(不存在则创建),返回 true=可用 */
async function ensureBasic(token, type, number, name, extra = {}) {
  if (!number) return false;
  if (sandboxCache[type].has(String(number))) return true;
  const paths = { supplier: '/jdy/v2/bd/supplier', customer: '/jdy/v2/bd/customer', material: '/jdy/v2/bd/material', store: '/jdy/v2/bd/store' };
  let body = { number: String(number), name: String(name || number) };
  // 商品创建必须带单位 ID(实测 base_unit_number 无效,须用 base_unit_id)
  if (type === 'material') {
    const unitId = await getDefaultUnitId(token);
    if (!unitId) { log(`    ✗ 无可用计量单位,无法创建商品 ${number}`); return false; }
    body = { ...body, base_unit_id: unitId, purchase_unit_id: unitId, sale_unit_id: unitId, store_unit_id: unitId };
  }
  const r = await kingdeePost(cfg.kingdee, token, paths[type], {}, body);
  if (r.ok) {
    sandboxCache[type].add(String(number));
    log(`    + 沙箱创建${type}: ${number}(${body.name})`);
    return true;
  }
  // 商品名称冲突 → 名称加编码后缀重试(金蝶不允许同名商品)
  if (type === 'material' && /已存在/.test(String(r.error || ''))) {
    const retryBody = { ...body, name: `${name}(${number})` };
    const r2 = await kingdeePost(cfg.kingdee, token, paths[type], {}, retryBody);
    if (r2.ok) {
      sandboxCache[type].add(String(number));
      log(`    + 沙箱创建${type}: ${number}(${retryBody.name}) [名称加编码消歧]`);
      return true;
    }
  }
  // 仓库/客户名称冲突 → 同样加编码后缀
  if ((type === 'store' || type === 'customer') && /已存在/.test(String(r.error || ''))) {
    const retryBody = { ...body, name: `${name}(${number})` };
    const r2 = await kingdeePost(cfg.kingdee, token, paths[type], {}, retryBody);
    if (r2.ok) {
      sandboxCache[type].add(String(number));
      log(`    + 沙箱创建${type}: ${number}(${retryBody.name}) [名称加编码消歧]`);
      return true;
    }
  }
  log(`    ✗ 沙箱创建${type}失败: ${number} → ${r.error?.slice(0, 80)}`);
  return false;
}

/** 取沙箱默认计量单位 ID(取第一个;可按 MES 单位名匹配优化) */
let cachedUnitId = null;
async function getDefaultUnitId(token) {
  if (cachedUnitId) return cachedUnitId;
  try {
    const r = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/measure_unit', { page: '1', page_size: '5' });
    const unit = (r.rows || []).find((u) => u.number === '个') || (r.rows || [])[0];
    if (unit) { cachedUnitId = unit.id; return cachedUnitId; }
  } catch { /* 忽略 */ }
  return null;
}

// ══ MES 基础资料 → 沙箱全量同步 ══

/** 类型冲突 fallback:只保留基础字段(去 EXTRA) */
function basicOnly(mapped) {
  const safeHead = ['bill_date', 'trans_type', 'supplier_number', 'customer_number', 'remark', 'bill_stock_number'];
  const safeLine = ['material_number', 'qty', 'price', 'cess', 'stock_number', 'batch_no', 'comment'];
  const out = {};
  for (const [k, v] of Object.entries(mapped)) {
    if (Array.isArray(v)) {
      out[k] = v.map((line) => Object.fromEntries(Object.entries(line).filter(([lk]) => safeLine.includes(lk))));
    } else if (safeHead.includes(k)) {
      out[k] = v;
    }
  }
  return out;
}
async function pushAllBasics(token) {
  log('── 同步基础资料到沙箱 ──');
  let created = 0, skipped = 0, failed = 0;

  // 供应商(dm_gf)
  const suppliers = (await pool.request().query(`
    SELECT dm AS 编码, mc AS 名称 FROM dm_gf WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(dm,'')<>''`)).recordset;
  for (const s of suppliers) {
    const ok = await ensureBasic(token, 'supplier', s.编码, s.名称);
    ok ? (sandboxCache.supplier.has(String(s.编码)) ? skipped++ : created++) : failed++;
  }
  log(`  供应商: ${suppliers.length} 个(新建 ${created},已有 ${skipped},失败 ${failed})`);

  // 客户(dm_kh)
  created = 0; skipped = 0; failed = 0;
  const customers = (await pool.request().query(`
    SELECT dm AS 编码, mc AS 名称 FROM dm_kh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(dm,'')<>''`)).recordset;
  for (const c of customers) {
    const ok = await ensureBasic(token, 'customer', c.编码, c.名称);
    ok ? (sandboxCache.customer.has(String(c.编码)) ? skipped++ : created++) : failed++;
  }
  log(`  客户: ${customers.length} 个(新建 ${created},已有 ${skipped},失败 ${failed})`);

  // 商品(bs_inv)
  created = 0; skipped = 0; failed = 0;
  const materials = (await pool.request().query(`
    SELECT 存货编码 AS 编码, 存货名称 AS 名称 FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(存货编码,'')<>''`)).recordset;
  for (const m of materials) {
    const ok = await ensureBasic(token, 'material', m.编码, m.名称);
    ok ? (sandboxCache.material.has(String(m.编码)) ? skipped++ : created++) : failed++;
  }
  log(`  商品: ${materials.length} 个(新建 ${created},已有 ${skipped},失败 ${failed})`);

  // 仓库(bs_wh)
  created = 0; skipped = 0; failed = 0;
  const stores = (await pool.request().query(`
    SELECT 仓库编码 AS 编码, 仓库名称 AS 名称 FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(仓库编码,'')<>''`)).recordset;
  for (const s of stores) {
    const ok = await ensureBasic(token, 'store', s.编码, s.名称);
    ok ? (sandboxCache.store.has(String(s.编码)) ? skipped++ : created++) : failed++;
  }
  log(`  仓库: ${stores.length} 个(新建 ${created},已有 ${skipped},失败 ${failed})`);

  // 职员(bs_emp)— 单据的业务员/经手人引用
  created = 0; skipped = 0; failed = 0;
  if (!sandboxCache.emp) sandboxCache.emp = new Set();
  const emps = (await pool.request().query(`
    SELECT 员工编码 AS 编码, 员工名称 AS 名称 FROM bs_emp WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(员工编码,'')<>'' AND ISNULL(停用,0)<>1`)).recordset;
  for (const e of emps) {
    if (sandboxCache.emp.has(String(e.编码))) { skipped++; continue; }
    const r = await kingdeePost(cfg.kingdee, token, '/jdy/v2/bd/emp', {}, { number: String(e.编码), name: String(e.名称) });
    if (r.ok) { sandboxCache.emp.add(String(e.编码)); created++; }
    else if (/已存在/.test(String(r.error || ''))) { sandboxCache.emp.add(String(e.编码)); skipped++; }
    else failed++;
  }
  log(`  职员: ${emps.length} 个(新建 ${created},已有 ${skipped},失败 ${failed})`);

  // 部门(bs_dept)
  created = 0; skipped = 0; failed = 0;
  if (!sandboxCache.dept) sandboxCache.dept = new Set();
  const depts = (await pool.request().query(`
    SELECT 部门编码 AS 编码, 部门名称 AS 名称 FROM bs_dept WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(部门编码,'')<>'' AND ISNULL(停用,0)<>1`)).recordset;
  for (const d of depts) {
    if (sandboxCache.dept.has(String(d.编码))) { skipped++; continue; }
    const r = await kingdeePost(cfg.kingdee, token, '/jdy/v2/bd/department', {}, { number: String(d.编码), name: String(d.名称) });
    if (r.ok) { sandboxCache.dept.add(String(d.编码)); created++; }
    else if (/已存在/.test(String(r.error || ''))) { sandboxCache.dept.add(String(d.编码)); skipped++; }
    else failed++;
  }
  log(`  部门: ${depts.length} 个(新建 ${created},已有 ${skipped},失败 ${failed})`);
}

// ══ MES → 金蝶 全量字段映射(EXTRA 反向:中文列名 → API 键) ══
/** 反向映射:MES 行数据 → 金蝶 API 对象(全量,含隐藏字段)
 *  类型推断:is_* → int(金蝶用 0/1);qty/amount/rate/price/coefficient → Number;其余 → String */
function reverseMap(row, entries) {
  const out = {};
  for (const e of entries || []) {
    const v = row[e.c];
    if (v === undefined || v === null || v === '') continue;
    if (e.a.includes('.')) continue;
    // 跳过跨沙箱引用:src_* 指向原沙箱的源单/内部ID,推到新沙箱会报"源单未审核或已被删除"
    // emp_number/dept_number:业务员/部门引用在新沙箱可能编码不匹配(非必填,跳过不影响单据创建)
    if (/^src_/.test(e.a) || /_id$/.test(e.a) || e.a === 'emp_number' || e.a === 'dept_number') continue;
    const s = String(v);
    // is_* 字段:金蝶期望 int32(0/1),不收 bool
    if (/^is_/.test(e.a)) { out[e.a] = s.toLowerCase() === 'true' || s === '1' ? 1 : 0; continue; }
    // 数量/金额/比率/系数类:金蝶期望 Number
    if (/qty|amount|rate|price|cost|coefficient|period|seq$|count|discount/i.test(e.a) && /^-?\d+\.?\d*$/.test(s)) {
      out[e.a] = Number(s); continue;
    }
    // 其余字符串;金蝶响应里如果是 int 字段会报错,此时 fallback 跳过
    out[e.a] = s;
  }
  return out;
}

/** 头字段:核心手工映射 + EXTRA 全量 */
function mapPurHead(h) {
  const base = {
    bill_date: String(h.单据日期 || '').slice(0, 10),
    trans_type: '2',
    supplier_number: String(h.供应商编码 || ''),
    remark: String(h.备注 || ''),
  };
  const extra = reverseMap(h, EXTRA.PURCHASE_IN || []);
  return { ...extra, ...base }; // base 覆盖(确保核心字段正确)
}
function mapPurLines(lines) {
  return (lines || []).map((l) => {
    const base = {
      material_number: String(l.存货编码 || ''),
      qty: Number(l.实收数量) || 0,
      price: Number(l.单价) || 0,
      cess: Number(l['税率%']) || 0,
      stock_number: String(l.仓库编码 || ''),
      batch_no: String(l.批号 || ''),
    };
    const extra = reverseMap(l, EXTRA_LINES.PURCHASE_IN || []);
    return { ...extra, ...base };
  });
}
function mapSaleHead(h) {
  const base = {
    bill_date: String(h.单据日期 || '').slice(0, 10),
    trans_type: '2',
    customer_number: String(h.客户编码 || ''),
    remark: String(h.备注 || ''),
  };
  const extra = reverseMap(h, EXTRA.SALE_OUT || []);
  return { ...extra, ...base };
}
function mapSaleLines(lines) {
  return (lines || []).map((l) => {
    const base = {
      material_number: String(l.存货编码 || ''),
      qty: Number(l.数量) || 0,
      price: Number(l.售价 || 0),
      cess: Number(l['税率%']) || 0,
      stock_number: String(l.仓库编码 || ''),
      batch_no: String(l.批号 || ''),
    };
    const extra = reverseMap(l, EXTRA_LINES.SALE_OUT || []);
    return { ...extra, ...base };
  });
}

// ══ 拉取 MES 待推送数据 ══
async function fetchPending(headTable, lineTable) {
  const excludeSynced = INCLUDE_SYNCED ? '' : `AND t.单据编号 NOT LIKE 'CGRK-%' AND t.单据编号 NOT LIKE 'XSCK-%'`;
  const heads = (await pool.request().query(`
    SELECT * FROM dbo.[${headTable}] t
    WHERE ISNULL(t.asp_cancel,'N') <> 'Y' AND ISNULL(t.asp_user1,'') <> '${N_PUSH_USER}'
      AND t.单据编号 NOT LIKE 'PI-%' ${excludeSynced}
    ORDER BY t.asp_time1 DESC`)).recordset;
  // ↑ 排除已从金蝶同步过来的单(CGRK/XSCK 前缀)和手工测试单(PI 前缀)
  if (!heads.length) return [];
  const out = [];
  for (const h of heads) {
    const lines = (await pool.request().query(`
      SELECT * FROM dbo.[${lineTable}] WHERE 单据编号 = '${String(h.单据编号).replace(/'/g, "''")}' AND ISNULL(asp_cancel,'N')<>'Y'`)).recordset;
    out.push({ head: h, lines });
  }
  return out;
}

// ══ 推送单据 ══
async function pushDoc(token, headTable, apiPath, doc, mapped, basics) {
  // 确保基础资料存在
  for (const b of basics) {
    const ok = await ensureBasic(token, b.type, b.number, b.name);
    if (!ok) { log(`  ✗ ${doc.head.单据编号}: 基础资料 ${b.type}:${b.number} 无法创建,跳过`); return false; }
  }
  log(`  → ${doc.head.单据编号} (${doc.lines.length} 行)`);
  if (DRY_RUN) { log(`    [dry-run] body: ${JSON.stringify(mapped).slice(0, 200)}`); return true; }
  let r = await kingdeePost(cfg.kingdee, token, apiPath, {}, mapped);
  // 类型错误 fallback:去掉引发冲突的字段重试(最多 3 轮)
  let retries = 0;
  while (!r.ok && /invalid value for/.test(String(r.error || '')) && retries < 3) {
    retries++;
    // 从错误信息提取字段名(proto: line 1:NNN 格式无法直接提取) → 简化:去掉所有非基础字段
    log(`    [重试${retries}] 类型冲突,回退到基础字段模式`);
    mapped = { ...basicOnly(mapped) };
    r = await kingdeePost(cfg.kingdee, token, apiPath, {}, mapped);
  }
  if (r.ok) {
    const kdeeNo = String(Object.values(r.data?.id_number_map || {})[0] || '');
    const kdeeId = String(r.data?.ids?.[0] || '');
    await pool.request().query(`
      UPDATE dbo.[${headTable}] SET asp_user1 = '${N_PUSH_USER}'
        ${kdeeNo ? `, 备注 = ISNULL(备注,'') + N' [金蝶:${kdeeNo}]'` : ''}
      WHERE 单据编号 = '${String(doc.head.单据编号).replace(/'/g, "''")}'`);
    log(`    ✓ → 金蝶单号: ${kdeeNo || kdeeId}`);
    return true;
  }
  log(`    ✗ ${r.error?.slice(0, 120)}`);
  return false;
}

// ══ 主流程 ══
async function main() {
  log(`=== MES → 金蝶 推送${DRY_RUN ? '(dry-run)' : ''} ===`);
  log(`沙箱: clientId=${cfg.kingdee.clientId} domain=${cfg.kingdee.domain}`);

  let token;
  try {
    const { token: t } = await fetchAppToken(cfg.kingdee);
    token = t;
    log(`✓ 沙箱连通`);
  } catch (e) { log(`✗ 连接失败: ${e.message}`); process.exit(1); }

  if (PROBE) { log('探测模式,退出'); await pool.close(); return; }

  // 加载沙箱基础资料缓存 + 同步 MES 全部基础资料到沙箱
  log('── 加载沙箱基础资料 ──');
  await loadSandboxBasics(token);
  if (!PROBE) {
    await pushAllBasics(token);
  }

  // 拉取待推送(只推 MES 手工建的,排除金蝶同步来的)
  const purDocs = await fetchPending('bd_purchase_in', 'bl_purchase_in');
  const saleDocs = await fetchPending('bd_sale_out', 'bl_sale_out');
  log(`\n待推送(仅MES手工单): 采购入库 ${purDocs.length} 单, 销售出库 ${saleDocs.length} 单`);
  if (!purDocs.length && !saleDocs.length) { log('无待推送数据'); await pool.close(); return; }

  if (!SKIP_CONFIRM && !DRY_RUN) {
    log(`⚠ 即将推送 ${purDocs.length + saleDocs.length} 张单据, 3 秒后开始...`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  let ok = 0, fail = 0;

  for (const doc of purDocs) {
    const mapped = { ...mapPurHead(doc.head), material_entity: mapPurLines(doc.lines) };
    // 供应商 + 每行的商品/仓库
    const basics = [{ type: 'supplier', number: doc.head.供应商编码, name: doc.head.供应商 }];
    for (const l of doc.lines) {
      if (l.存货编码) basics.push({ type: 'material', number: l.存货编码, name: l.存货名称 });
      if (l.仓库编码) basics.push({ type: 'store', number: l.仓库编码, name: l.仓库 });
    }
    const r = await pushDoc(token, 'bd_purchase_in', '/jdy/v2/scm/pur_inbound', doc, mapped, basics);
    r ? ok++ : fail++;
  }

  for (const doc of saleDocs) {
    const mapped = { ...mapSaleHead(doc.head), material_entity: mapSaleLines(doc.lines) };
    const basics = [{ type: 'customer', number: doc.head.客户编码, name: doc.head.客户 }];
    for (const l of doc.lines) {
      if (l.存货编码) basics.push({ type: 'material', number: l.存货编码, name: l.存货名称 });
      if (l.仓库编码) basics.push({ type: 'store', number: l.仓库编码, name: l.仓库 });
    }
    const r = await pushDoc(token, 'bd_sale_out', '/jdy/v2/scm/sal_out_bound', doc, mapped, basics);
    r ? ok++ : fail++;
  }

  log(`\n=== 完成: 成功 ${ok}, 失败 ${fail} ===`);
  await pool.close();
  if (fail > 0) process.exitCode = 2;
}

main().catch(async (e) => { log(`FATAL: ${e.message}`); try { await pool.close(); } catch {} process.exit(1); });
