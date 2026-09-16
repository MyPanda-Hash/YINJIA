#!/usr/bin/env node
// push-inbound-outbound.mjs — MES → 金蝶 增量推送(采购入库 + 销售出库)
// 方向:MES 本地新建/修改的单据 → 推送到金蝶云·星辰(写入沙箱测试)
// 增量口径:asp_user1 = 'mes-push' 标记已推送;未标记的 = 待推送
// 用法:
//   node push-inbound-outbound.mjs              # 推送(交互确认)
//   node push-inbound-outbound.mjs --yes        # 推送(跳过确认)
//   node push-inbound-outbound.mjs --dry-run    # 演练(不写库不推金蝶)
//   node push-inbound-outbound.mjs --probe      # 仅探测沙箱连通性
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PARENT = join(HERE, '..'); // deploy/ 根(共用 kingdee-client,不改原脚本)
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const PROBE = args.has('--probe');
const SKIP_CONFIRM = args.has('--yes');

const cfgPath = join(HERE, 'config.json');
if (!existsSync(cfgPath)) { console.error('缺少 push/config.json(推送专用沙箱配置)'); process.exit(1); }
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

// ── 金蝶客户端(复用 deploy/ 根的 kingdee-client.mjs,不改动原文件) ──
const { fetchAppToken, kingdeeGet, kingdeePost } = await import(pathToFileURL(join(PARENT, 'kingdee-client.mjs')).href);

// ── 数据库 ──
const mssql = (await import('mssql')).default;
const pool = new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433,
  database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
await pool.connect();

const N_PUSH_USER = 'mes-push';

// ══ MES → 金蝶 字段映射(反向:中文列 → API 键) ══
function mapPurInboundHead(h) {
  return {
    bill_date: h.单据日期 || '',
    trans_type: '2', // 采购入库
    supplier_number: h.供应商编码 || '',
    emp_number: h.经手人编码 || '',
    remark: h.备注 || '',
    bill_status: h.单据状态 === '已审核' ? 'C' : 'A',
  };
}
function mapPurInboundLines(lines) {
  return (lines || []).map((l) => ({
    material_number: l.存货编码 || '',
    qty: Number(l.实收数量) || 0,
    unit_number: '',
    price: Number(l.单价) || 0,
    cess: Number(l['税率%']) || 0,
    stock_number: l.仓库编码 || '',
    batch_no: l.批号 || '',
    comment: l.备注 || '',
  }));
}
function mapSaleOutHead(h) {
  return {
    bill_date: h.单据日期 || '',
    trans_type: '2', // 销售出库
    customer_number: h.客户编码 || '',
    emp_number: h.经手人编码 || '',
    remark: h.备注 || '',
    bill_status: h.单据状态 === '已审核' ? 'C' : 'A',
  };
}
function mapSaleOutLines(lines) {
  return (lines || []).map((l) => ({
    material_number: l.存货编码 || '',
    qty: Number(l.数量) || 0,
    unit_number: '',
    price: Number(l.售价) || 0,
    cess: Number(l['税率%']) || 0,
    stock_number: l.仓库编码 || '',
    batch_no: l.批号 || '',
    comment: l.备注 || '',
  }));
}

// ══ 拉取 MES 待推送数据 ══
async function fetchPending(panelCode, headTable, lineTable) {
  // 增量:asp_user1 不是 'mes-push' 且未作废的单据
  const heads = (await pool.request().query(`
    SELECT * FROM dbo.[${headTable}] t
    WHERE ISNULL(t.asp_cancel,'N') <> 'Y'
      AND ISNULL(t.asp_user1,'') <> '${N_PUSH_USER}'
    ORDER BY t.asp_time1 DESC`)).recordset;
  if (!heads.length) return [];
  const out = [];
  for (const h of heads) {
    const lines = (await pool.request().query(`
      SELECT * FROM dbo.[${lineTable}] WHERE 单据编号 = '${String(h.单据编号).replace(/'/g, "''")}' AND ISNULL(asp_cancel,'N')<>'Y'`)).recordset;
    out.push({ head: h, lines });
  }
  return out;
}

// ══ 推送到金蝶 ══
async function pushToKingdee(token, panelCode, apiPath, docs) {
  let ok = 0, fail = 0;
  for (const doc of docs) {
    const body = doc.mapped; // 无包装:直接平铺(实测 data 包装会导致 material_entity 解析不到)
    log(`  → 推送 ${doc.head.单据编号} ...`);
    if (DRY_RUN) { log(`    [dry-run] 跳过`); ok++; continue; }
    const r = await kingdeePost(cfg.kingdee, token, apiPath, {}, body);
    if (r.ok) {
      ok++;
      // 标记已推送 + 回写金蝶单号
      const kdeeId = String(r.data?.ids?.[0] || '');
      const kdeeNo = String(Object.values(r.data?.id_number_map || {})[0] || '');
      await pool.request().query(`
        UPDATE dbo.[${doc.headTable}] SET asp_user1 = '${N_PUSH_USER}'
          ${kdeeNo ? `, 备注 = ISNULL(备注,'') + N' [金蝶:${kdeeNo}]'` : ''}
        WHERE 单据编号 = '${String(doc.head.单据编号).replace(/'/g, "''")}'`);
      log(`    ✓ 成功 → 金蝶单号: ${kdeeNo || kdeeId || '(未返回)'}`);
    } else {
      fail++;
      log(`    ✗ 失败: ${r.error}`);
    }
  }
  return { ok, fail };
}

// ══ 主流程 ══
async function main() {
  log(`=== MES → 金蝶 推送${DRY_RUN ? '(dry-run)' : ''} ===`);
  log(`沙箱: clientId=${cfg.kingdee.clientId} domain=${cfg.kingdee.domain}`);

  // 1. 探测连通
  let token;
  try {
    const { token: t } = await fetchAppToken(cfg.kingdee);
    token = t;
    log(`✓ 沙箱连通 (app-token 获取成功)`);
  } catch (e) {
    log(`✗ 沙箱连接失败: ${e.message}`);
    process.exit(1);
  }

  if (PROBE) { log('探测模式,退出'); await pool.close(); return; }

  // 2. 探测写入接口是否存在
  for (const [path, label] of [
    ['/jdy/v2/scm/pur_inbound', '采购入库保存(POST)'],
    ['/jdy/v2/scm/sal_out_bound', '销售出库保存(POST)'],
  ]) {
    const test = await kingdeePost(cfg.kingdee, token, path, {}, { data: {} });
    const err = String(test.error || '');
    const canUse = test.ok || /参数|字段|必填|不能为空|data/i.test(err);
    log(`  ${label} [POST ${path}]: ${canUse ? '✓ 接口可达' : `不可达 (${err.slice(0, 80)})`}`);
  }

  // 3. 拉取待推送数据
  const purDocs = await fetchPending('PURCHASE_IN', 'bd_purchase_in', 'bl_purchase_in');
  const saleDocs = await fetchPending('SALE_OUT', 'bd_sale_out', 'bl_sale_out');
  log(`待推送: 采购入库 ${purDocs.length} 单, 销售出库 ${saleDocs.length} 单`);

  if (!purDocs.length && !saleDocs.length) { log('无待推送数据'); await pool.close(); return; }

  // 4. 确认
  if (!SKIP_CONFIRM && !DRY_RUN) {
    const total = purDocs.length + saleDocs.length;
    log(`⚠ 即将向沙箱推送 ${total} 张单据, 3 秒后开始...`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  // 5. 推送
  let totalOk = 0, totalFail = 0;

  if (purDocs.length) {
    log(`\n══ 采购入库 ══`);
    const mapped = purDocs.map((d) => ({
      head: d.head, headTable: 'bd_purchase_in',
      mapped: { ...mapPurInboundHead(d.head), material_entity: mapPurInboundLines(d.lines) },
    }));
    const r = await pushToKingdee(token, 'PURCHASE_IN', '/jdy/v2/scm/pur_inbound', mapped);
    totalOk += r.ok; totalFail += r.fail;
  }

  if (saleDocs.length) {
    log(`\n══ 销售出库 ══`);
    const mapped = saleDocs.map((d) => ({
      head: d.head, headTable: 'bd_sale_out',
      mapped: { ...mapSaleOutHead(d.head), material_entity: mapSaleOutLines(d.lines) },
    }));
    const r = await pushToKingdee(token, 'SALE_OUT', '/jdy/v2/scm/sal_out_bound', mapped);
    totalOk += r.ok; totalFail += r.fail;
  }

  log(`\n=== 推送完成: 成功 ${totalOk}, 失败 ${totalFail} ===`);
  await pool.close();
  if (totalFail > 0) process.exitCode = 2;
}

main().catch(async (e) => { log(`FATAL: ${e.message}`); try { await pool.close(); } catch {} process.exit(1); });
