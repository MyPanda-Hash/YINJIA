// 金蝶云·星辰单据同步 · 共享核心(由 sync.mjs / init-sync.mjs 调用)
// 支持多单据类型(DOCS 注册表,当前:销售订单 SO_ORDER + 采购订单 PU_ORDER)
// mode='incremental'(增量): 已审核 + 时间窗(默认31天),计划任务高频跑
// mode='init'(初始化/复核): 全量(无时间窗),首次部署与定期对账用
//
// 关键机制:
//   指纹跳过  : 列表级字段指纹存 头表.外部指纹,无变化的单不调详情
//   幂等      : 外部数据ID 唯一索引,重拉=覆盖更新;审核状态镜像 yj_doc_status
//   授权轮换  : outerInstanceId 自动获取 appKey/appSecret(24h轮换),1030002006 自愈
//   窗口端点  : modify_end_time 前移 endBiasMinutes(实测端点=now会偶发漏单,前移规避)
import { readFileSync, writeFileSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';
import { makeLogger, confirmBatch, backupBeforeWrite } from './safety.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const N_SYNC_USER = '金蝶同步'; // 星辰审核人缺失时 yj_doc_status.shr 的兜底留痕

// ---------- 单据类型注册表 ----------
const DOCS = [
  {
    code: 'SO_ORDER', label: '销售订单',
    listPath: '/jdy/v2/scm/sal_order',
    detailPath: '/jdy/v2/scm/sal_order_detail',
    headTable: 'bd_so_order', lineTable: 'bl_so_order',
    fingerprintOf: (r) => [r.bill_status, r.bill_close_state, r.bill_date, r.customer_name,
      r.customer_number, r.dept_name, r.emp_name, r.total_amount, r.io_status, r.real_io_status]
      .map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapHead(d) {
      const dates = (d.material_entity || []).map((m) => m.delivery_date).filter(Boolean).sort();
      return {
        单据编号: str(d.bill_no), 单据日期: str(d.bill_date),
        客户: str(d.customer_name), 客户编码: str(d.customer_number), 结算客户: str(d.settle_customer_number),
        部门: str(d.dept_name), 部门负责人: null, 业务员: str(d.emp_name), 项目: null,
        汇率: num(d.exchange_rate), 结算期限: str(d.setting_term_name), // 币种待「币别」档案同步后经 currency_id→名称对照回填
        预计交货日期: dates[0] || null, 联系人: str(d.contact_linkman), 备注: str(d.remark),
        单据状态: d.bill_status === 'C' ? '已审核' : '草稿',
        审核人: str(d.auditor_name), 审核时间: str(d.audit_time),
      };
    },
    mapLines(d) {
      return (d.material_entity || []).map((m) => ({
        单据编号: str(d.bill_no), 品牌: null,
        存货名称: str(m.material_name), 存货编码: str(m.material_number), 规格型号: str(m.material_model),
        数量: num(m.qty), 销售单位: str(m.unit_name) || str(m.unit_number),
        单价: num(m.price), '税率%': num(m.cess), 含税单价: num(m.tax_price),
        金额: num(m.amount), 含税金额: num(m.all_amount), 折扣金额: num(m.dis_amount),
        预计交货日期: str(m.delivery_date), 现存量: num(m.inv_qty), 备注: str(m.comment),
      }));
    },
  },
  {
    code: 'PU_ORDER', label: '采购订单',
    listPath: '/jdy/v2/scm/pur_order',
    detailPath: '/jdy/v2/scm/pur_order_detail',
    headTable: 'bd_pu_order', lineTable: 'bl_pu_order',
    // 采购列表行无金额字段,指纹以供应商/执行状态/备注等组合
    fingerprintOf: (r) => [r.bill_status, r.bill_close_state, r.bill_date, r.supplier_name,
      r.supplier_number, r.emp_name, r.io_status, r.real_io_status, r.remark]
      .map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapHead(d) {
      const dates = (d.material_entity || []).map((m) => m.delivery_date).filter(Boolean).sort();
      return {
        单据编号: str(d.bill_no), 单据日期: str(d.bill_date),
        供应商: str(d.supplier_name), 供应商编码: str(d.supplier_number),
        // 本地列 NOT NULL:星辰只给 currency_id(无名称),默认人民币/汇率1
        币种: '人民币', 汇率: num(d.exchange_rate) ?? 1, 到货地址: null, 结算期限: str(d.setting_term_name),
        交货日期: dates[0] || null, 发货状态: null, 合同号: null, 订金金额: null, 付款方式: null,
        数据来源: '金蝶同步', 备注: str(d.remark),
        单据状态: d.bill_status === 'C' ? '已审核' : '草稿',
        审核人: str(d.auditor_name), 审核时间: str(d.audit_time),
      };
    },
    mapLines(d) {
      return (d.material_entity || []).map((m) => ({
        单据编号: str(d.bill_no),
        // 本地列 NOT NULL:物料/单位/数量/单价 缺失时兜底空串/0
        物料编码: str(m.material_number) || '', 物料名称: str(m.material_name) || '', 规格型号: str(m.material_model),
        单位: str(m.unit_name) || str(m.unit_number) || '', 数量: num(m.qty) ?? 0,
        单价: num(m.price) ?? 0, 金额: num(m.amount), '税率%': num(m.cess),
        含税单价: num(m.tax_price), 含税金额: num(m.all_amount),
        数量2: num(m.aux_qty), 计量单位2: str(m.aux_unit_name), 仓库: str(m.stock_name),
        '折扣%': num(m.dis_rate), 折扣金额: num(m.dis_amount),
        预计到货日期: str(m.delivery_date), 现存量: num(m.inv_qty), 现存量说明: null, 备注: str(m.comment),
      }));
    },
  },
];

// ---------- 基础 ----------
const readText = (p) => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const str = (v) => (v === undefined || v === null || v === '' ? null : String(v));
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const nowLocal = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 日志:控制台 + logs/sync-YYYY-MM-DD.log(按日轮转,规范要求保留至少一年)
let logger = null;
const log = (msg) => {
  if (logger) return logger.log(msg);
  const line = `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${msg}`;
  console.log(line);
};

/** 进程是否存活(判断锁归属者是否还在运行) */
function pidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/**
 * 跨进程互斥锁:锁文件记录持有者 PID。
 * 持有者进程仍存活 → 让行(无论运行多久,长跑初始化不会被误判过期);
 * 持有者已退出 或 锁文件损坏且超龄 → 接管。
 */
function acquireLock() {
  const lock = join(HERE, 'sync.lock');
  try {
    if (existsSync(lock)) {
      const owner = Number(readText(lock).trim());
      const age = Date.now() - statSync(lock).mtimeMs;
      if (owner && owner !== process.pid && pidAlive(owner)) {
        log(`另一同步实例运行中(PID ${owner}),本次跳过`);
        return false;
      }
      if (!owner && age < 10 * 60000) {
        log('锁文件存在且未超龄,本次跳过');
        return false;
      }
      log(`接管过期锁(原持有者 PID ${owner || '未知'} 已退出)`);
    }
  } catch { /* 锁文件异常则视为无锁 */ }
  writeFileSync(lock, String(process.pid), 'utf8');
  return true;
}
/** 仅释放自己的锁(避免误删其他实例的锁) */
function releaseLock() {
  try {
    const lock = join(HERE, 'sync.lock');
    if (existsSync(lock) && Number(readText(lock).trim()) === process.pid) unlinkSync(lock);
  } catch { /* 忽略 */ }
}

/** 通用参数类型推断:null→nvarchar,数字→decimal(18,4),其余→nvarchar */
function inferType(value) {
  if (typeof value === 'number') return { type: 'decimal', precision: 18, scale: 4 };
  return { type: 'nvarchar', length: 500 };
}
/** 生成参数化 SQL 片段:返回 { sql:@pN 占位, inputs:[[name,type,value]...] } */
function paramify(req, mssql, entries) {
  const inputs = [];
  const names = entries.map(([col, val]) => {
    const p = `p${inputs.length}`;
    const t = inferType(val);
    if (t.type === 'decimal') req.input(p, mssql.Decimal(t.precision, t.scale), val);
    else req.input(p, mssql.NVarChar(t.length), val);
    inputs.push(col);
    return `@${p}`;
  });
  return { names, inputs };
}

/** 单据落库(通用):头表 upsert + 行表先删后插 + 审核状态镜像,单事务 */
async function upsertDoc(doc, mssql, pool, head, lines, fp) {
  const tx = new mssql.Transaction(pool);
  await tx.begin();
  try {
    const r = new mssql.Request(tx);
    // 头表参数:仅业务列(剔除 元数据__前缀列 与 外部数据ID,它们由核心统一管理)
    const headEntries = Object.entries(head)
      .filter(([col]) => !col.startsWith('__') && col !== '外部数据ID')
      .map(([col, val]) => [ `[${col}]`, val ]);
    const setPairs = headEntries.map(([col], i) => `${col}=@p${i}`);
    const insCols = headEntries.map(([col]) => col);
    // 元数据参数从 headEntries.length 起编号
    const base = headEntries.length;
    headEntries.push(['@__ctime', head.__创建时间], ['@__extid', head.外部数据ID], ['@__fp', fp], ['@__now', nowLocal()]);
    const { names } = paramify(r, mssql, headEntries);
    await r.query(`
      UPDATE ${doc.headTable} SET
        ${setPairs.join(', ')},
        asp_user1=N'jdy-sync', asp_time1=COALESCE(@p${base}, asp_time1), asp_cancel=N'N',
        外部数据ID=@p${base + 1}, 外部指纹=@p${base + 2}
      WHERE 外部数据ID=@p${base + 1} OR (外部数据ID IS NULL AND 单据编号=@p0);
      IF @@ROWCOUNT = 0
        INSERT INTO ${doc.headTable} (${insCols.join(', ')}, asp_user1, asp_time1, asp_cancel, 外部数据ID, 外部单据号, 外部指纹)
        VALUES (${names.slice(0, base).join(', ')}, N'jdy-sync', COALESCE(@p${base}, @p${base + 3}), N'N', @p${base + 1}, @p0, @p${base + 2});
      DELETE FROM ${doc.lineTable} WHERE 单据编号=@p0;`);
    // 审核状态镜像(工作流注册表)
    r.input('m_shr', mssql.NVarChar(50), head.单据状态 === '已审核' ? (head.审核人 || N_SYNC_USER) : null);
    r.input('m_shsj', mssql.NVarChar(30), head.单据状态 === '已审核' ? head.审核时间 : null);
    r.input('m_stopped', mssql.NVarChar(1), head.__已关闭 ? 'Y' : 'N');
    await r.query(`
      MERGE yj_doc_status AS t USING (VALUES (N'${doc.code}', @p0)) AS s(panel_code, doc_no)
      ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no
      WHEN MATCHED THEN UPDATE SET
        shr = @m_shr, shsj = @m_shsj, canceled = N'N', stopped = @m_stopped, pending = N'N', update_at = GETDATE()
      WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, shr, shsj, canceled, stopped, pending, update_at)
        VALUES (s.panel_code, s.doc_no, @m_shr, @m_shsj, N'N', @m_stopped, N'N', GETDATE());`);
    // 行表(列名直接用本地中文列;asp_time1 作为普通参数)
    for (const l of lines) {
      const lr = new mssql.Request(tx);
      const entries = Object.entries(l).map(([col, val]) => [`[${col}]`, val]);
      entries.push(['@__lnow', nowLocal()]);
      const { names: ln } = paramify(lr, mssql, entries);
      await lr.query(`INSERT INTO ${doc.lineTable} (${entries.slice(0, -1).map(([c]) => c).join(', ')}, asp_user1, asp_time1, asp_cancel)
        VALUES (${ln.slice(0, -1).join(', ')}, N'jdy-sync', @p${entries.length - 1}, N'N');`);
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

// ---------- 主流程 ----------
export async function runCore({ mode, configPath, dryRun = false, probe = false, assumeYes = false }) {
  configPath = configPath || join(HERE, 'config.json');
  if (!existsSync(configPath)) {
    console.error(`✗ 未找到配置文件 ${configPath}\n  请复制 config.example.json 为 config.json 并填入凭证/数据库信息`);
    process.exit(1);
  }
  const cfg = JSON.parse(readText(configPath));
  const s = cfg.sync || {};
  const opt = {
    billStatus: (mode === 'incremental' ? s.billStatus : s.initBillStatus) ?? 'C',
    windowDays: s.windowDays || 31,
    endBiasMinutes: s.endBiasMinutes === undefined ? 180 : s.endBiasMinutes,
    pageSize: s.pageSize || 100,
    maxPages: s.maxPages || 60,
    types: Array.isArray(s.types) && s.types.length ? s.types : DOCS.map((d) => d.code),
    confirmThreshold: s.confirmThreshold === undefined ? 200 : s.confirmThreshold,
    confirmTimeoutSeconds: s.confirmTimeoutSeconds === undefined ? 5 : s.confirmTimeoutSeconds,
    logRetentionDays: s.logRetentionDays || 365,
    backupRetentionDays: s.backupRetentionDays || 365,
  };
  logger = makeLogger({ baseDir: HERE, retentionDays: opt.logRetentionDays });
  const docs = DOCS.filter((d) => opt.types.includes(d.code));
  const statePath = join(HERE, 'state.json');
  const state = existsSync(statePath) ? JSON.parse(readText(statePath)) : {};
  const saveState = () => writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

  // 跨进程互斥(初始化长跑期间,计划任务的增量自动让行)
  if (!probe && !acquireLock()) return;

  // app-token(缓存约23小时)
  let token = state.appToken;
  if (!(token && state.appTokenExpireAt && Date.now() < state.appTokenExpireAt)) {
    const { token: t, domain } = await fetchAppToken(cfg.kingdee);
    if (domain && domain !== cfg.kingdee.domain) {
      log(`授权信息返回了新的 IDC 域名 ${domain},后续请求已采用`);
      cfg.kingdee.domain = domain;
    }
    state.appToken = token = t;
    state.appTokenExpireAt = Date.now() + 23 * 3600 * 1000;
    saveState();
    log(`app-token 已刷新(缓存至 ${new Date(state.appTokenExpireAt).toLocaleString()})`);
  }
  const modeLabel = mode === 'incremental' ? '增量' : '初始化/复核';
  log(`app-token 就绪(${token.slice(0, 6)}...) [${modeLabel}]`);

  // probe:逐类型验证全链路
  if (probe) {
    for (const doc of docs) {
      const data = await kingdeeGet(cfg.kingdee, token, doc.listPath, { bill_status: opt.billStatus, page: '1', page_size: '1' });
      log(`probe ${doc.label}:列表 ${data.count} 条(认证正常)`);
      if ((data.rows || []).length) {
        const d = await kingdeeGet(cfg.kingdee, token, doc.detailPath, { id: data.rows[0].id });
        console.log(JSON.stringify({ [doc.label]: { 头: doc.mapHead(d), 行: doc.mapLines(d).slice(0, 2) } }, null, 2));
      }
    }
    log('probe 完成:认证、列表、详情、字段映射全链路正常');
    return;
  }

  let mssql = null, pool = null;
  if (!dryRun) {
    mssql = (await import('mssql')).default;
    pool = new mssql.ConnectionPool({
      server: cfg.database.server, port: cfg.database.port || 1433,
      database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
      options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
    });
    await pool.connect();
  }

  let totalIn = 0, totalUp = 0, totalFail = 0;
  try {
    for (const doc of docs) {
      // 列表(增量带时间窗;端点前移规避实测的边界漏单)
      const listParams = { bill_status: opt.billStatus, page: '1', page_size: String(opt.pageSize) };
      if (mode === 'incremental') {
        const now = Date.now();
        listParams.modify_start_time = String(now - opt.windowDays * 86400000);
        listParams.modify_end_time = String(now + opt.endBiasMinutes * 60000);
      }
      const rows = [];
      for (let page = 1; page <= opt.maxPages; page++) {
        const data = await kingdeeGet(cfg.kingdee, token, doc.listPath, { ...listParams, page: String(page) });
        for (const r of data.rows || []) rows.push(r);
        const totalPage = Number(data.total_page || 1);
        if (page === 1) log(`【${doc.label}】列表第 1/${totalPage} 页,共 ${data.count} 条${mode === 'incremental' ? `(近${opt.windowDays}天修改/新增)` : '(全量)'}`);
        if (page >= totalPage) break;
      }
      if (!rows.length) { log(`【${doc.label}】无符合条件单据`); continue; }

      // 指纹比对先行:算出真正要写的单(新增/有变化)——提示、备份、写入都只针对它们
      let knownFps = new Map();
      if (!dryRun) {
        const rs = await new mssql.Request(pool).query(
          `SELECT 外部数据ID AS id, 外部指纹 AS fp FROM ${doc.headTable} WHERE 外部数据ID IS NOT NULL`);
        for (const row of rs.recordset) knownFps.set(String(row.id).trim(), row.fp ? String(row.fp).trim() : '');
      }
      const changedRows = rows.filter((row) => {
        const id = String(row.id).trim();
        return !(knownFps.has(id) && knownFps.get(id) === doc.fingerprintOf(row));
      });
      const skipped = rows.length - changedRows.length;
      log(`【${doc.label}】共 ${rows.length} 条,待写入 ${changedRows.length} 条${skipped ? `,无变化跳过 ${skipped}` : ''}`);
      if (!changedRows.length) continue;

      // 规范:批量写入前按"实际写入量"提示(超阈值),并只备份将被影响的单据前像;未确认则整类跳过。
      // 注:备份范围=待写单(增量)或全量前像(初始化);无变化时不产生备份文件。
      if (!dryRun) {
        const ok = await confirmBatch({
          log, label: `【${doc.label}】`, planned: changedRows.length,
          threshold: opt.confirmThreshold, assumeYes,
          timeoutMs: (opt.confirmTimeoutSeconds === undefined ? 5 : opt.confirmTimeoutSeconds) * 1000,
        });
        if (!ok) continue;
        await backupBeforeWrite({
          mssql, pool, baseDir: HERE, panel: doc.code,
          headTable: doc.headTable, lineTable: doc.lineTable,
          docNos: mode === 'init' ? null : changedRows.map((r) => r.bill_no).filter(Boolean),
          retentionDays: opt.backupRetentionDays, log,
        });
      }

      let inserted = 0, updated = 0, failed = 0, dup = 0, done = 0;
      for (const row of changedRows) {
        done++;
        if (changedRows.length > 200 && done % 500 === 0) log(`【${doc.label}】进度 ${done}/${changedRows.length}(新增${inserted} 更新${updated})`);
        const fp = doc.fingerprintOf(row);
        const known = knownFps.has(String(row.id).trim());
        try {
          const d = await kingdeeGet(cfg.kingdee, token, doc.detailPath, { id: row.id });
          const head = {
            ...doc.mapHead(d),
            外部数据ID: str(d.id),
            __创建时间: str(d.create_time),
            __已关闭: d.bill_close_state === 'S' || d.bill_close_state === 'H',
          };
          const lines = doc.mapLines(d);
          if (dryRun) {
            console.log(`—— 【${doc.label}】${head.单据编号}(${head[doc.code === 'PU_ORDER' ? '供应商' : '客户']}) 状态=${head.单据状态} 行数=${lines.length}`);
            continue;
          }
          await upsertDoc(doc, mssql, pool, head, lines, fp);
          knownFps.set(String(row.id).trim(), fp); // 本轮内去重(列表偶有重复行)
          known ? updated++ : inserted++;
          if (inserted + updated <= 10 || (inserted + updated) % 100 === 0) {
            log(`【${doc.label}】${known ? '更新' : '新增'} ${head.单据编号}(${lines.length} 行)`);
          }
          await sleep(120); // 详情调用节流
        } catch (e) {
          if (/duplicate key|2627|2601/i.test(String(e.message))) {
            dup++; // 并发实例已写入(唯一索引兜底),视为让行
            continue;
          }
          failed++;
          log(`✗ 【${doc.label}】单据 ${row.bill_no || row.id} 处理失败: ${e.message}`);
        }
      }
      log(`【${doc.label}】完成:新增 ${inserted},更新 ${updated},失败 ${failed}${dup ? `,并发让行 ${dup}` : ''}`);
      totalIn += inserted; totalUp += updated; totalFail += failed;
    }
  } finally {
    if (pool) await pool.close();
    releaseLock();
  }

  if (!dryRun) {
    state.lastSyncMs = Date.now();
    saveState();
  }
  log(`全部完成:新增 ${totalIn},更新 ${totalUp},失败 ${totalFail}${dryRun ? '(dry-run 未写库)' : ''}`);
  if (totalFail > 0) process.exitCode = 2;
}
