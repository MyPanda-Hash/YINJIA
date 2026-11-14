#!/usr/bin/env node
// =====================================================================================
// sync-stock.mjs — 金蝶库存数量同步(以金蝶真实账套的现存量为准,每 5 分钟一轮)
//
// 用户口径(2026-11-10):
//   「同步脚本能不能实时同步金蝶真实账套的库存数量,我们想要以金蝶的库存数量为准」
//   → 选 B:直接覆盖 kucun.yl(金蝶即唯一库存),每 5 分钟一轮;验收期不按批次追溯。
//
// 做什么(一次运行 = 一轮):
//   ① 拉金蝶现存量 GET /jdy/v2/inv/inv_inventory_ims(维度 = 商品编码 + 仓库编码 + 批号,分页 500/页);
//   ② 写 erp_stock_snapshot(本轮逐键快照:金蝶数量 / 覆盖前 MES 数量 / 差异 / 处理方式);
//   ③ 覆盖 kucun:金蝶有的键 → yl = 金蝶数量;金蝶没有的键 → yl = 0(留痕不删行);
//   ④ 写 erp_stock_sync_log(行数/覆盖/新增/清零/一致/差异合计/耗时/状态);
//   ⑤ 改动前把受影响行前像落 deploy/backup/stock-<批次>.jsonl(可回滚)。
//
// 为什么不能"推送式实时"(重要,别再被问第二遍):
//   金蝶星辰开放平台没有库存变更的推送/订阅接口(现有实测只有查询族),所以"实时"只能是
//   准实时轮询。账套限流 500 次/分钟,现存量一轮只 3~4 次调用 ⇒ 5 分钟一轮的开销可忽略;
//   把间隔改成 1 分钟技术上可行,但没有意义(单据审核 → 转ERP 本身是分钟级链路)。
//
// 三处必须知道的口径(改动前先读):
//   1) **批号**:真实账套现存量 `batch_no` 当前全为空(2026-11-10 实测 1396 行 0 行有批号)⇒
//      金蝶数量一律落在 lot_no 为 NULL/'' 的那一行;MES 里有真实批次的行会被清零(数量并入
//      无批号行)。(物料, 仓库) 合计 = 金蝶合计,这正是"验收期不按批次追溯"的口径。
//      正式上线要按批次核销时,见 docs/development/上线前必验-库存批次追溯.md。
//   2) **单价**:现存量接口不给单价 ⇒ 只写数量,**绝不碰 kucun.price / inv_cost_ledger**
//      (成本走入库单价的移动加权,月结/成本报表依赖它)。
//   3) **MES 本地刚审核、还没转ERP 的单据**:下一轮同步会把它的库存改动抹平(金蝶为准)——
//      kucun.差异数量 是计算列(金蝶数量 − yl),抹平前会如实显示偏差,可作为"漏转ERP"的信号。
//
// 用法:
//   node sync-stock.mjs                       正式同步(计划任务 JdyStockSync 每 5 分钟)
//   node sync-stock.mjs --dry-run             只看会改什么,不写库(打印差异 TOP 10)
//   node sync-stock.mjs --db=HSDZ_MES_TEST    指定目标库(默认取 config.json 的 database)
//   node sync-stock.mjs --force               跳过"行数骤降"保护(金蝶侧真被删了很多行时才用)
//   node sync-stock.mjs --config=D:\path\config.json
//   node sync-stock.mjs --probe               只验金蝶接口(不连库)
//
// 安全闸门(任一命中即整轮放弃、不改一个字节):
//   · 金蝶返回 0 行(接口异常时最怕把整仓库存清成 0);
//   · 本次行数 < 上一轮成功行数的 50%(分页/鉴权异常的先兆);--force 可越过;
//   · 上一轮还在跑(锁文件记录 PID 且进程存活)。
// =====================================================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchAppToken, kingdeeTryGet } from './kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const IMS_PATH = '/jdy/v2/inv/inv_inventory_ims';
/** 数量比较容差(kucun.yl 是 float,金蝶是 decimal(18,4)) */
const TOL = 0.00005;
/** 同步写入的操作人(与单据同步 jdy-sync 区分,便于在 kucun 上分辨谁改的) */
const SYNC_USER = '金蝶同步';
/** 行数骤降保护:本次 < 上轮 × 该比例 → 放弃 */
const SHRINK_GUARD = 0.5;

const args = process.argv.slice(2);
const argOf = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : undefined;
};
const has = (name) => args.includes(`--${name}`);

// ---------- 日志:控制台 + logs/stock-sync-YYYY-MM-DD.log ----------
const nowStr = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' ');
};
let logFile = null;
const log = (msg) => {
  const line = `[${nowStr()}] ${msg}`;
  console.log(line);
  try {
    if (!logFile) {
      const dir = join(HERE, 'logs');
      mkdirSync(dir, { recursive: true });
      logFile = join(dir, `stock-sync-${nowStr().slice(0, 10)}.log`);
    }
    writeFileSync(logFile, line + '\n', { encoding: 'utf8', flag: 'a' });
  } catch { /* 写日志失败不影响同步 */ }
};

/** 锁文件:持有者 PID 仍存活则让行(5 分钟一轮,撞车只可能是上一轮卡住) */
function acquireLock() {
  const lock = join(HERE, 'stock-sync.lock');
  try {
    if (existsSync(lock)) {
      const owner = Number(readFileSync(lock, 'utf8').trim());
      const age = Date.now() - statSync(lock).mtimeMs;
      let alive = false;
      try { if (owner) { process.kill(owner, 0); alive = true; } } catch { alive = false; }
      if (alive) { log(`上一轮(PID ${owner})仍在跑,本轮跳过`); return false; }
      if (!owner && age < 10 * 60000) { log('锁文件存在且未超龄,本轮跳过'); return false; }
      log(`接管过期锁(PID ${owner || '未知'} 已退出)`);
    }
  } catch { /* 锁文件异常视为无锁 */ }
  writeFileSync(lock, String(process.pid), 'utf8');
  return true;
}
function releaseLock() {
  try {
    const lock = join(HERE, 'stock-sync.lock');
    if (existsSync(lock) && Number(readFileSync(lock, 'utf8').trim()) === process.pid) unlinkSync(lock);
  } catch { /* 忽略 */ }
}

/**
 * app-token:与 sync-core 共用 state.json。
 * 为什么共用:取令牌接口**限频 2 次/分钟**,两个 5 分钟计划任务若各自冷启动就会踩线;
 * 令牌 24h 有效,复用它等于每天只取一次。只回写 token 两键,不动 lastSyncMs。
 */
async function getToken(cfg, statePath) {
  let state = {};
  // BOM 容错:配置/状态文件若是记事本或 PowerShell 写的(UTF-8 with BOM),JSON.parse 会直接抛
  // "Unexpected token '\uFEFF'"。这份文件在服务器上可能被人工编辑过,不能假定无 BOM。
  try { state = JSON.parse(readFileSync(statePath, 'utf8').replace(/^\uFEFF/, '')); } catch { state = {}; }
  if (state.appToken && state.appTokenExpireAt && Date.now() < state.appTokenExpireAt) {
    log('app-token 复用缓存');
    return state.appToken;
  }
  const { token } = await fetchAppToken(cfg.kingdee);
  state.appToken = token;
  state.appTokenExpireAt = Date.now() + 23 * 3600 * 1000;
  try { writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8'); } catch { /* 缓存写失败不影响本轮 */ }
  log('app-token 已刷新(缓存至 ' + new Date(state.appTokenExpireAt).toLocaleString() + ')');
  return token;
}

/** 拉全量现存量;任何一页失败即抛(宁可整轮放弃,也不能拿半份数据覆盖库存) */
async function fetchAllInventory(cfg, token, pageSize, maxPages) {
  const rows = [];
  let pages = 0;
  let declared = null;
  for (let page = 1; page <= maxPages; page++) {
    const r = await kingdeeTryGet(cfg.kingdee, token, IMS_PATH, { page: String(page), page_size: String(pageSize) });
    if (!r.ok) throw new Error(`现存量第 ${page} 页失败:${r.error}`);
    declared = r.data.count ?? declared;
    const rs = r.data.rows || [];
    rows.push(...rs);
    pages++;
    if (rs.length < pageSize) break;
    await new Promise((s) => setTimeout(s, 120)); // 限流友好(账套级 500 次/分钟)
  }
  log(`金蝶现存量:声明 ${declared ?? '?'} 行 · 实拉 ${rows.length} 行 · ${pages} 页`);
  return rows;
}

// ---------- 三键归一(与 kucun 口径一致) ----------
const normCode = (v) => String(v == null ? '' : v).trim();
/**
 * 批号归一:只把空串看成"无批号"(落 NULL),**PC0000 等占位批号按字面保留**。
 *
 * <p>⚠ 2026-11-10 试跑踩坑:早先这里把 {@code PC0000} 也归成 NULL(理由是 MES 曾做过 PC0000 归一),
 * 结果**两侧匹配口径不一致** —— JS 侧把 PC0000 行与无批号行当成同一个键(Map 后写覆盖),
 * SQL 侧 {@code ISNULL(lot_no,'') = ISNULL(批号,'')} 是字面比较(PC0000 ≠ ''),于是 PC0000 行
 * 既没被覆盖也没被清零,每轮都被当成"仅 MES 有"重报一次。现在**两侧统一按字面匹配**:
 * PC0000 就是普通批号,金蝶没有它 ⇒ "仅 MES 有" ⇒ 清零(其数量并入无批号行,物料合计不变)。
 */
const normLot = (v) => {
  const s = normCode(v);
  return s === '' ? null : s;
};
const keyOf = (wzdm, ckdm, lot) => `${normCode(wzdm)}\u0001${normCode(ckdm)}\u0001${normLot(lot) || ''}`;

/** 现存量行 → 归一化三键聚合(理论上一行一键;聚合是防御:分页重叠时数量不会翻倍) */
function normalize(rows) {
  const kd = new Map();
  for (const r of rows) {
    const material = normCode(r.material_number);
    const stock = normCode(r.stock_number);
    if (!material || !stock) continue;
    const k = keyOf(material, stock, r.batch_no);
    const cur = kd.get(k) || {
      物料编码: material, 物料名称: r.material_name || null,
      仓库编码: stock, 仓库名称: r.stockid_name || r.stock_name || null,
      批号: normLot(r.batch_no), 单位: r.aux_unit_name || r.unit_number || null, 数量: 0,
    };
    cur.数量 += Number(r.qty || 0);
    kd.set(k, cur);
  }
  return kd;
}

/**
 * 库存同步主流程(可被两处调用,别各写一套):
 *   · 单独跑:`node sync-stock.mjs [...]`(本文件底部的直接执行块);
 *   · 合并跑:`node sync.mjs`(档案/订单同步完顺手做库存)—— 见该文件的 import。
 *
 * @param {object}  [opts]
 * @param {string}  [opts.configPath] 配置文件路径,默认 deploy/config.json
 * @param {boolean} [opts.dryRun]     只算差异不写库
 * @param {boolean} [opts.force]      越过"行数骤降"保护
 * @param {boolean} [opts.probe]      只验金蝶接口(不连库)
 * @param {string}  [opts.dbName]     目标库,默认取 config.database.database
 * @param {number}  [opts.pageSize]   现存量分页大小
 * @param {number}  [opts.maxPages]   最多翻页数
 * @param {string}  [opts.source]     调用来源(写进日志,便于分辨是哪个入口跑的)
 * @returns {Promise<{ok:boolean, applied?:boolean, skipped?:string, stats?:object, batchNo?:string}>}
 */
export async function runStockSync(opts = {}) {
  const startedAt = Date.now();
  log(`—— 库存同步开始(${opts.source || 'standalone'})——`);
  if (!acquireLock()) return { ok: false, skipped: '已在运行' };
  try {
    return await syncOnce(opts);
  } finally {
    releaseLock();
    log(`—— 库存同步结束(${((Date.now() - startedAt) / 1000).toFixed(1)}s)——`);
  }
}

async function syncOnce(opts = {}) {
  const configPath = opts.configPath || argOf('config') || join(HERE, 'config.json');
  if (!existsSync(configPath)) {
    throw new Error(`未找到配置文件 ${configPath}`);
  }
  const cfg = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  const s = cfg.stock || {};
  // 合并跑时允许用配置关掉库存(2026-11-10):config.json 的 stock.enabled=false ⇒ 只同步档案/订单。
  // 单独跑(sync-stock.mjs)同样尊重它,免得"配了关掉却又被手工跑起来"。
  if (s.enabled === false && !(opts.forceEnabled === true)) {
    log('config.stock.enabled=false,本轮跳过库存同步');
    return { ok: true, applied: false, skipped: 'disabled' };
  }
  const pageSize = Number(opts.pageSize || argOf('page-size') || s.pageSize || 500);
  const maxPages = Number(opts.maxPages || argOf('max-pages') || s.maxPages || 40);
  const keepLogDays = Number(s.logRetentionDays || 180);
  const dryRun = opts.dryRun !== undefined ? !!opts.dryRun : has('dry-run');
  const force = opts.force !== undefined ? !!opts.force : has('force');
  const probe = opts.probe !== undefined ? !!opts.probe : has('probe');
  const dbName = opts.dbName || argOf('db') || cfg.database.database;
  const account = `${cfg.kingdee.clientId}/${cfg.kingdee.outerInstanceId}`;

  const token = await getToken(cfg, join(HERE, 'state.json'));

  // ① 拉金蝶现存量
  const raw = await fetchAllInventory(cfg, token, pageSize, maxPages);
  if (probe) {
    const first = raw[0] || {};
    log(`probe OK:首行 ${first.material_number} | ${first.stock_number} | lot=${first.batch_no || '(空)'} | qty=${first.qty}`);
    return { ok: true, applied: false, skipped: 'probe' };
  }
  if (!raw.length) throw new Error('金蝶现存量返回 0 行 —— 拒绝覆盖库存(先把接口/授权查清)');
  const kd = normalize(raw);
  log(`归一化后 ${kd.size} 个三元键(商品|仓库|批号)`);

  // ② 连库
  const mssql = (await import('mssql')).default;
  const pool = new mssql.ConnectionPool({
    server: cfg.database.server, port: cfg.database.port, database: dbName,
    user: cfg.database.user, password: cfg.database.password,
    options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
    pool: { max: 4, min: 0, idleTimeoutMillis: 5000 },
  });
  await pool.connect();

  try {
    // ③ 上一轮行数(骤降保护)
    const last = (await pool.request().query(`SELECT TOP 1 [金蝶行数], [批次号] FROM dbo.erp_stock_sync_log
                                               WHERE [状态] = N'成功' ORDER BY id DESC`)).recordset;
    if (last.length && Number(last[0].金蝶行数) > 0) {
      const ratio = kd.size / Number(last[0].金蝶行数);
      if (!force && ratio < SHRINK_GUARD) {
        throw new Error(`本次 ${kd.size} 行 < 上一轮 ${last[0].金蝶行数} 行 × ${SHRINK_GUARD} —— `
          + '疑似分页/授权异常,拒绝覆盖(确认金蝶侧真的少了这么多行时加 --force)');
      }
    }

    // ④ 与 MES 现状对账(先算清楚"会改什么",dry-run 与真跑共用这一段)
    const ku = (await pool.request().query(
      `SELECT id, wzdm, ckdm, lot_no, yl FROM dbo.kucun WHERE ISNULL(asp_cancel,'N') <> 'Y'`)).recordset;
    const mes = new Map();
    const dupKeys = [];
    for (const r of ku) {
      const k = keyOf(r.wzdm, r.ckdm, r.lot_no);
      if (mes.has(k)) { dupKeys.push(k); continue; }
      mes.set(k, r);
    }
    // 同一个三键在 kucun 里出现两行 ⇒ 覆盖时两行都会被写成金蝶数量(库存翻倍)、差异也算不准。
    // 两账套实测 0 组,但这是"数据被外部写坏"时最危险的形态,宁可整轮停手。
    if (dupKeys.length) {
      throw new Error(`kucun 有 ${dupKeys.length} 个重复三键(同一 物料|仓库|批号 多行),`
        + `覆盖会让库存翻倍,先合并再同步。样例:${dupKeys.slice(0, 5).map((k) => k.replace(/\u0001/g, '|')).join(' · ')}`);
    }

    let same = 0, changed = 0, added = 0, zeroed = 0, sumDiff = 0;
    const diffs = [];
    for (const [k, v] of kd) {
      const m = mes.get(k);
      if (!m) {
        added++; sumDiff += v.数量;
        diffs.push({ k, kd: v.数量, mes: null });
        continue;
      }
      const d = v.数量 - Number(m.yl || 0);
      if (Math.abs(d) <= TOL) same++;
      else { changed++; sumDiff += d; diffs.push({ k, kd: v.数量, mes: Number(m.yl || 0) }); }
    }
    const zeroRows = [];
    for (const [k, m] of mes) {
      if (kd.has(k)) continue;
      const yl = Number(m.yl || 0);
      if (Math.abs(yl) > TOL) {
        zeroed++; sumDiff -= yl;
        zeroRows.push(m);
        diffs.push({ k, kd: 0, mes: yl });
      }
    }
    log(`对账:MES ${mes.size} 键 · 一致 ${same} · 覆盖 ${changed} · 新增 ${added} · 清零 ${zeroed}`
      + ` · 差异合计 ${sumDiff.toFixed(2)}`);
    diffs.sort((a, b) => Math.abs((b.kd ?? 0) - (b.mes ?? 0)) - Math.abs((a.kd ?? 0) - (a.mes ?? 0)));
    for (const d of diffs.slice(0, 10)) {
      log(`  差异 ${d.k.replace(/\u0001/g, ' | ')}: 金蝶 ${d.kd ?? 0} / MES ${d.mes ?? 0}`);
    }

    if (dryRun) {
      log('--dry-run 结束(未写库)');
      return { ok: true, applied: false, skipped: 'dry-run', stats: { same, changed, added, zeroed, sumDiff } };
    }

    // ⑤ 前像备份(本次会被改写/清零的行,落一份 JSONL 便于逐行回滚)
    const stamp = new Date();
    const batchNo = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}`
      + `${String(stamp.getDate()).padStart(2, '0')}${String(stamp.getHours()).padStart(2, '0')}`
      + `${String(stamp.getMinutes()).padStart(2, '0')}${String(stamp.getSeconds()).padStart(2, '0')}`;
    if (diffs.length) {
      const bdir = join(HERE, 'backup');
      mkdirSync(bdir, { recursive: true });
      const file = join(bdir, `stock-${batchNo}.jsonl`);
      const lines = diffs.map((d) => {
        const m = mes.get(d.k);
        return JSON.stringify({
          批次号: batchNo, 键: d.k.replace(/\u0001/g, '|'), 金蝶数量: d.kd ?? null,
          原MES行id: m ? m.id : null, 原现存量: m ? Number(m.yl || 0) : null,
        });
      });
      writeFileSync(file, lines.join('\n') + '\n', 'utf8');
      log(`前像已备份:${file}(${diffs.length} 行)`);
    }

    // ⑥ 单事务:快照 → 覆盖 kucun → 日志
    const atDate = new Date();                 // 落库用 Date(DateTime2 参数),日志/批次号用本地时间串
    const at = nowStr();
    const t0 = Date.now();
    const tx = new mssql.Transaction(pool);
    await tx.begin();
    try {
      // 6.1 快照整表替换(只保留"最近一轮";历史轮次与行数看 erp_stock_sync_log)
      await new mssql.Request(tx).query('DELETE FROM dbo.erp_stock_snapshot');

      // 6.2 灌入金蝶行(处理方式先写占位「待定」,6.3 按命中情况回填一致/覆盖/新增)
      const snapshotRows = [...kd.values()].map((r) => ({
        物料编码: r.物料编码, 物料名称: r.物料名称, 仓库编码: r.仓库编码, 仓库名称: r.仓库名称,
        批号: r.批号, 单位: r.单位, 数量: r.数量,
      }));
      const CHUNK = 100; // 100 行 × 7 参数 = 700,远低于 SQL Server 2100 参数上限
      for (let i = 0; i < snapshotRows.length; i += CHUNK) {
        const part = snapshotRows.slice(i, i + CHUNK);
        const req = new mssql.Request(tx);
        req.input('batch', mssql.NVarChar(20), batchNo);
        req.input('at', mssql.DateTime2, atDate);
        const values = part.map((r, j) => {
          const p = j * 7;
          req.input(`c${p}`, mssql.NVarChar(60), r.物料编码);
          req.input(`c${p + 1}`, mssql.NVarChar(200), r.物料名称);
          req.input(`c${p + 2}`, mssql.NVarChar(400), r.仓库编码);
          req.input(`c${p + 3}`, mssql.NVarChar(200), r.仓库名称);
          req.input(`c${p + 4}`, mssql.NVarChar(60), r.批号);
          req.input(`c${p + 5}`, mssql.NVarChar(40), r.单位);
          req.input(`c${p + 6}`, mssql.Decimal(18, 4), Number(Number(r.数量).toFixed(4)));
          return `(@batch,@at,@c${p},@c${p + 1},@c${p + 2},@c${p + 3},@c${p + 4},@c${p + 5},@c${p + 6},N'待定',N'${SYNC_USER}',@at,N'N')`;
        });
        await req.query(`INSERT INTO dbo.erp_stock_snapshot
            (批次号,同步时间,物料编码,物料名称,仓库编码,仓库名称,批号,单位,金蝶数量,处理方式,asp_user1,asp_time1,asp_cancel)
          VALUES ${values.join(',')}`);
      }

      // 6.3 回填「覆盖前 MES 数量 / 差异 / 处理方式」——必须在覆盖之前取前像(同一事务内)
      await new mssql.Request(tx)
        .input('batch', mssql.NVarChar(20), batchNo)
        .input('tol', mssql.Decimal(18, 4), TOL)
        .query(`UPDATE s SET
             [MES原数量] = CAST(ISNULL(k.yl, 0) AS decimal(18, 4)),
             [差异数量] = s.[金蝶数量] - CAST(ISNULL(k.yl, 0) AS decimal(18, 4)),
             [处理方式] = CASE WHEN ABS(s.[金蝶数量] - CAST(ISNULL(k.yl, 0) AS decimal(18, 4))) <= @tol
                               THEN N'一致' ELSE N'覆盖' END
           FROM dbo.erp_stock_snapshot s
           JOIN dbo.kucun k ON k.wzdm = s.[物料编码] AND k.ckdm = s.[仓库编码]
                AND ISNULL(k.lot_no, '') = ISNULL(s.[批号], '') AND ISNULL(k.asp_cancel, 'N') <> 'Y'
          WHERE s.[批次号] = @batch AND s.[处理方式] = N'待定'`);
      // 6.4 金蝶有、MES 没有的键 → 标「新增」,并把差异补全(=金蝶数量,因为 MES 原来没有这一行)
      await new mssql.Request(tx)
        .input('batch', mssql.NVarChar(20), batchNo)
        .query(`UPDATE dbo.erp_stock_snapshot
                   SET [处理方式] = N'新增', [MES原数量] = CAST(0 AS decimal(18,4)), [差异数量] = [金蝶数量]
                 WHERE [批次号] = @batch AND [处理方式] = N'待定'`);
      // 6.5 仅 MES 有的键(金蝶侧已无余额)→ 追加一行「清零」快照(金蝶数量 0),随后一起被覆盖为 0。
      //      用 #zero 中转而不是 INSERT…SELECT 自读快照表,避免"目标表出现在自身子查询"这种写法。
      await new mssql.Request(tx)
        .input('batch', mssql.NVarChar(20), batchNo)
        .input('at', mssql.DateTime2, atDate)
        .input('tol', mssql.Decimal(18, 4), TOL)
        .query(`SELECT k.wzdm AS 物料编码, k.ckdm AS 仓库编码, NULLIF(k.lot_no, '') AS 批号,
                       CAST(0 AS decimal(18,4)) AS 金蝶数量,
                       CAST(ISNULL(k.yl, 0) AS decimal(18,4)) AS MES原数量,
                       CAST(0 - ISNULL(k.yl, 0) AS decimal(18,4)) AS 差异数量
                  INTO #zero
                  FROM dbo.kucun k
                 WHERE ISNULL(k.asp_cancel, 'N') <> 'Y' AND ABS(ISNULL(k.yl, 0)) > @tol
                   AND NOT EXISTS (SELECT 1 FROM dbo.erp_stock_snapshot s
                                    WHERE s.[批次号] = @batch AND s.[物料编码] = k.wzdm
                                      AND s.[仓库编码] = k.ckdm
                                      AND ISNULL(s.[批号], '') = ISNULL(k.lot_no, ''));
                INSERT INTO dbo.erp_stock_snapshot
                    (批次号,同步时间,物料编码,仓库编码,批号,金蝶数量,MES原数量,差异数量,处理方式,asp_user1,asp_time1,asp_cancel)
                  SELECT @batch, @at, 物料编码, 仓库编码, 批号, 金蝶数量, MES原数量, 差异数量,
                         N'清零', N'${SYNC_USER}', @at, N'N'
                    FROM #zero;
                DROP TABLE #zero;`);
      // 6.6 新增落库:补一行结存(累计入/出按数量符号拆,保证 rkl−ckl=yl)
      await new mssql.Request(tx)
        .input('batch', mssql.NVarChar(20), batchNo)
        .input('at', mssql.DateTime2, atDate)
        .query(`INSERT INTO dbo.kucun
            (wzdm, ckdm, lot_no, in_date, rkl, ckl, yl, price, [金蝶数量], [金蝶同步时间],
             asp_user1, asp_time1, asp_cancel)
          SELECT s.[物料编码], s.[仓库编码], NULLIF(s.[批号], ''), GETDATE(),
                 CASE WHEN s.[金蝶数量] > 0 THEN s.[金蝶数量] ELSE 0 END,
                 CASE WHEN s.[金蝶数量] < 0 THEN -s.[金蝶数量] ELSE 0 END,
                 s.[金蝶数量], NULL, s.[金蝶数量], @at, N'${SYNC_USER}', @at, N'N'
            FROM dbo.erp_stock_snapshot s
           WHERE s.[批次号] = @batch AND s.[处理方式] = N'新增'
             AND NOT EXISTS (SELECT 1 FROM dbo.kucun k
                              WHERE k.wzdm = s.[物料编码] AND k.ckdm = s.[仓库编码]
                                AND ISNULL(k.lot_no, '') = ISNULL(s.[批号], '')
                                AND ISNULL(k.asp_cancel, 'N') <> 'Y')`);
      // 6.7 覆盖(含清零行:它们的金蝶数量是 0)
      await new mssql.Request(tx)
        .input('batch', mssql.NVarChar(20), batchNo)
        .input('at', mssql.DateTime2, atDate)
        .input('tol', mssql.Decimal(18, 4), TOL)
        .query(`UPDATE k SET
             yl = s.[金蝶数量], [金蝶数量] = s.[金蝶数量], [金蝶同步时间] = @at,
             update_date = GETDATE(), asp_user2 = N'${SYNC_USER}', asp_time2 = @at
           FROM dbo.kucun k
           JOIN dbo.erp_stock_snapshot s ON k.wzdm = s.[物料编码] AND k.ckdm = s.[仓库编码]
                AND ISNULL(k.lot_no, '') = ISNULL(s.[批号], '') AND ISNULL(k.asp_cancel, 'N') <> 'Y'
          WHERE s.[批次号] = @batch
            AND (ABS(CAST(ISNULL(k.yl, 0) AS decimal(18,4)) - s.[金蝶数量]) > @tol
                 OR ISNULL(k.[金蝶数量], -999999) <> s.[金蝶数量]
                 OR k.[金蝶同步时间] IS NULL)`);
      // 6.7b 金蝶侧没有、MES 侧本来就 0 的键:不参与覆盖,但也标成"金蝶数量 0" ⇒
      //      库存状况页整列有值(空着会被读成"没同步过"),差异列也不会出现 -0 这种噪音。
      await new mssql.Request(tx)
        .input('batch', mssql.NVarChar(20), batchNo)
        .input('at', mssql.DateTime2, atDate)
        .query(`UPDATE k SET [金蝶数量] = 0, [金蝶同步时间] = @at, asp_user2 = N'${SYNC_USER}', asp_time2 = @at
                  FROM dbo.kucun k
                 WHERE ISNULL(k.asp_cancel, 'N') <> 'Y' AND k.[金蝶数量] IS NULL
                   AND NOT EXISTS (SELECT 1 FROM dbo.erp_stock_snapshot s
                                    WHERE s.[批次号] = @batch AND s.[物料编码] = k.wzdm
                                      AND s.[仓库编码] = k.ckdm
                                      AND ISNULL(s.[批号], '') = ISNULL(k.lot_no, ''))`);
      // 6.8 日志(计数直接从快照分类汇出来,与写进去的数据天然一致)
      const stat = (await new mssql.Request(tx)
        .input('batch', mssql.NVarChar(20), batchNo)
        .query(`SELECT SUM(CASE WHEN [处理方式] = N'覆盖' THEN 1 ELSE 0 END) AS upd,
                       SUM(CASE WHEN [处理方式] = N'新增' THEN 1 ELSE 0 END) AS ins,
                       SUM(CASE WHEN [处理方式] = N'清零' THEN 1 ELSE 0 END) AS zero,
                       SUM(CASE WHEN [处理方式] = N'一致' THEN 1 ELSE 0 END) AS same,
                       CAST(ISNULL(SUM([差异数量]), 0) AS decimal(18,4)) AS diff
                  FROM dbo.erp_stock_snapshot WHERE [批次号] = @batch`)).recordset[0] || {};
      await new mssql.Request(tx)
        .input('batch', mssql.NVarChar(20), batchNo)
        .input('acc', mssql.NVarChar(80), account)
        .input('at', mssql.DateTime2, atDate)
        .input('ms', mssql.Int, Date.now() - t0)
        .input('kd', mssql.Int, kd.size)
        .input('upd', mssql.Int, Number(stat.upd || 0))
        .input('ins', mssql.Int, Number(stat.ins || 0))
        .input('zero', mssql.Int, Number(stat.zero || 0))
        .input('same', mssql.Int, Number(stat.same || 0))
        .input('diff', mssql.Decimal(18, 4), Number(stat.diff || 0))
        .input('keep', mssql.Int, keepLogDays)
        .query(`INSERT INTO dbo.erp_stock_sync_log
            (批次号,账套,开始时间,结束时间,耗时毫秒,金蝶行数,覆盖行数,新增行数,清零行数,一致行数,差异合计,状态,asp_user1,asp_time1,asp_cancel)
          VALUES (@batch,@acc,@at,@at,@ms,@kd,@upd,@ins,@zero,@same,@diff,N'成功',N'${SYNC_USER}',@at,N'N');
          DELETE FROM dbo.erp_stock_sync_log WHERE 开始时间 < DATEADD(day, -@keep, GETDATE());`);
      await tx.commit();
      log(`已提交:批次 ${batchNo} · 覆盖 ${stat.upd || 0} · 新增 ${stat.ins || 0} · 清零 ${stat.zero || 0}`
        + ` · 一致 ${stat.same || 0} · 差异合计 ${Number(stat.diff || 0).toFixed(2)}`);
      log(`库 ${dbName} 的 kucun 已对齐金蝶(账套 ${account})`);
      return {
        ok: true, applied: true, batchNo,
        stats: {
          same: Number(stat.same || 0), changed: Number(stat.upd || 0),
          added: Number(stat.ins || 0), zeroed: Number(stat.zero || 0),
          diff: Number(stat.diff || 0), kdRows: kd.size,
        },
      };
    } catch (e) {
      await tx.rollback();
      // 失败也留一行日志(排查"这一轮为什么没动库存"时有据可查)
      try {
        await new mssql.Request(pool)
          .input('batch', mssql.NVarChar(20), batchNo)
          .input('acc', mssql.NVarChar(80), account)
          .input('at', mssql.DateTime2, atDate)
          .input('kd', mssql.Int, kd.size)
          .input('err', mssql.NVarChar(1000), String(e.message || e).slice(0, 1000))
          .query(`INSERT INTO dbo.erp_stock_sync_log
              (批次号,账套,开始时间,金蝶行数,状态,错误信息,asp_user1,asp_time1,asp_cancel)
            VALUES (@batch,@acc,@at,@kd,N'失败',@err,N'${SYNC_USER}',@at,N'N')`);
      } catch { /* 日志写不进就算了 */ }
      throw e;
    }
  } finally {
    await pool.close();
  }
}

// ---------- 直接执行(单独跑:node sync-stock.mjs …) ----------
// 被 sync.mjs 合并调用时**不会**走这里(import 不触发),避免同一个流程跑两遍。
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    const r = await runStockSync({ source: 'sync-stock.mjs' });
    if (r && r.ok === false) process.exitCode = 1;
  } catch (e) {
    log(`✗ 库存同步失败:${e.message}`);
    process.exitCode = 1;
  }
}

