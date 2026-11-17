#!/usr/bin/env node
/**
 * sync-presence.mjs —— 「金蝶在册核对」:金蝶那边**删了/作废了**,MES 这边不能还当"已审核"继续生单。
 *
 * 【为什么需要它(2026-11-16 用户口径)】
 *   增量同步只拉「bill_status=C(已审核) + 近 31 天修改」的单据 ⇒ 金蝶**删除**、**作废**、
 *   **反审核回草稿**的单会从列表里"消失"。而同步从不删 MES 单据 ⇒ 那张单在 MES 里**永远停在
 *   「已审核」**,于是分批送料/生单照样能点、能生成暂收/检验/入库,而且不报错、没人看得出来。
 *   已经被拦住的只有两种:金蝶**手动关闭 H** → 已中止、**自动关单 S** → 已完成(状态推导已处理);
 *   **删除/作废**是裸奔的。
 *
 * 【本模块做什么(只认"外部数据ID"非空的金蝶来源单,本地自建单一律不碰)】
 *   1. 廉价预判:每轮只问两个数(总数 / 已审核数);与上轮相同且 24 小时内做过全量 ⇒ 直接跳过;
 *   2. 全量对差:拉金蝶全列表(不带状态过滤,含作废 Z),与 MES 的 外部数据ID 逐条比:
 *        · 金蝶找不到  → 标记 `yj_doc_status.erp_close_state='D'`(金蝶已删除)
 *        · 金蝶不是 C  → 标记 `'Z'`(金蝶已作废/已反审核)
 *      状态推导(QueryService.docStatus / ButtonService.docStatusOf)把 D/Z 显示成
 *      「金蝶已删除 / 金蝶已作废」⇒ **现有的「仅已审核可生单」闸门自动拦住**,不改生单逻辑;
 *   3. **有下游痕迹的只标记不删**(form_flow_link 占用 / 材料码 bd_pu_label / 批次台账 yj_doc_batch):
 *      删了等于把已经发生的收货藏起来,只能人工处置;日志逐条点名,提示去金蝶确认;
 *   4. **没有任何下游痕迹的软删**(头/行 `asp_cancel='Y'` + 清 `外部指纹`):面板里不再出现;
 *      若金蝶那边其实还在,下一轮同步会按"无指纹"重新拉回来并复活(头表 UPDATE 写回 asp_cancel='N');
 *   5. 金蝶侧又变回 C 的单,把 D/Z 标记清掉(自愈);
 *   6. 安全闸门:一次命中超过 max(20, 5%) ⇒ 判定"金蝶列表没取全",**一个都不动**,只留告警。
 *
 * 【用法】
 *   node sync-presence.mjs               # 正式(会写库)
 *   node sync-presence.mjs --dry-run     # 只读:算出会动哪些单,不写库
 *   node sync-presence.mjs --full        # 忽略计数预判,强制全量对差
 *   (sync.mjs 每轮在「库存 → 档案/订单」之后自动调一次;失败不影响本轮同步结果)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';
import { DOCS } from './sync-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE = join(HERE, 'state.json');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
/** 本地墙钟(yyyy-MM-dd HH:mm:ss)—— 只用于日志与 state.json 里的时间戳,不参与业务判断 */
const nowLocal = () => {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} `
    + `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
};

/** 一次命中占比超过它 ⇒ 认为金蝶列表取不全,整类跳过(不动数据) */
const MAX_HIT_RATIO = 0.05;
const MIN_HIT_LIMIT = 20;
/** 24 小时至少全量对差一次(计数不变也可能"删一张 + 加一张") */
const FULL_RECHECK_MS = 24 * 3600 * 1000;

/** 有下游痕迹 → 只能标记不能删;返回痕迹来源(空串=没有痕迹) */
async function hasTrace(mssql, pool, doc, no) {
  const run = async (sql, paramName) => {
    const r = new mssql.Request(pool);
    r.input(paramName, mssql.NVarChar(100), no);
    if (sql.includes('@code')) r.input('code', mssql.NVarChar(50), doc.code);
    const rs = (await r.query(sql)).recordset;
    return rs.length > 0;
  };
  try {
    if (await run(`SELECT TOP 1 1 AS x FROM form_flow_link WHERE source_panel_code=@code AND source_form_no=@no`, 'no')) return 'form_flow_link';
  } catch { /* 表不存在 */ }
  try {
    if (await run(`SELECT TOP 1 1 AS x FROM yj_doc_batch WHERE source_panel_code=@code AND source_form_no=@no`, 'no')) return 'yj_doc_batch';
  } catch { /* 表不存在 */ }
  if (doc.code === 'PU_ORDER') {
    try {
      if (await run(`SELECT TOP 1 1 AS x FROM bd_pu_label WHERE 采购订单号=@no`, 'no')) return 'bd_pu_label';
    } catch { /* 表不存在 */ }
  }
  return '';
}

/** 标记「金蝶已删除(D)/已作废(Z)」—— MERGE 只写 erp_close_state,不碰 canceled/stopped */
async function markGone(mssql, pool, doc, no, kind) {
  const r = new mssql.Request(pool);
  r.input('code', mssql.NVarChar(50), doc.code);
  r.input('no', mssql.NVarChar(100), no);
  r.input('kind', mssql.NVarChar(1), kind);
  await r.query(`
    MERGE yj_doc_status AS t USING (VALUES (@code, @no)) AS s(panel_code, doc_no)
    ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no
    WHEN MATCHED THEN UPDATE SET erp_close_state = @kind, update_at = GETDATE()
    WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, canceled, stopped, erp_close_state, pending, update_at)
      VALUES (s.panel_code, s.doc_no, N'N', N'N', @kind, N'N', GETDATE());`);
}

/** 无下游痕迹 → 软删(并清 外部指纹,让金蝶若还在时下一轮能复活) */
async function softRemove(mssql, pool, doc, no) {
  for (const sql of [
    `UPDATE ${doc.headTable} SET asp_cancel=N'Y', asp_user2=N'jdy-sync', asp_time2=SYSDATETIME(), 外部指纹=NULL
      WHERE 单据编号=@no`,
    `UPDATE ${doc.lineTable} SET asp_cancel=N'Y', asp_user2=N'jdy-sync', asp_time2=SYSDATETIME()
      WHERE 单据编号=@no`,
  ]) {
    const r = new mssql.Request(pool);
    r.input('no', mssql.NVarChar(100), no);
    await r.query(sql);
  }
}

/** 金蝶侧又变回已审核 ⇒ 清掉 D/Z 标记;返回清掉的条数 */
async function clearMark(mssql, pool, doc, no) {
  const r = new mssql.Request(pool);
  r.input('code', mssql.NVarChar(50), doc.code);
  r.input('no', mssql.NVarChar(100), no);
  const rs = await r.query(`UPDATE yj_doc_status SET erp_close_state=NULL, update_at=GETDATE()
                             WHERE panel_code=@code AND doc_no=@no AND ISNULL(erp_close_state,N'') IN (N'D', N'Z')`);
  return rs.rowsAffected ? rs.rowsAffected[0] : 0;
}

/** 拉金蝶全列表 → Map(外部数据ID → bill_status);返回 null 表示"没取全,不可信" */
async function pullErpAll(cfg, token, doc, expectCount, log) {
  const map = new Map();
  const PAGE = 200;
  for (let page = 1; page <= 60; page++) {
    const data = await kingdeeGet(cfg.kingdee, token, doc.listPath, { page: String(page), page_size: String(PAGE) });
    for (const r of data.rows || []) map.set(String(r.id).trim(), String(r.bill_status || '').trim());
    if (page >= Number(data.total_page || 1) || !(data.rows || []).length) break;
  }
  if (expectCount > 0 && map.size !== expectCount) {
    log(`⚠ 【在册核对】${doc.label}:金蝶说共 ${expectCount} 条,实拉 ${map.size} 条(列表没取全)⇒ 本类跳过,不动数据`);
    return null;
  }
  return map;
}

/**
 * @param {{configPath?:string, dryRun?:boolean, full?:boolean, log?:(m:string)=>void}} opt
 */
export async function runPresenceCheck({ configPath, dryRun = false, full = false, log = console.log } = {}) {
  const cfg = readJson(configPath || join(HERE, 'config.json'));
  const s = cfg.sync || {};
  const types = Array.isArray(s.types) && s.types.length ? s.types : DOCS.map((d) => d.code);
  // 只核「金蝶同步的单据类」:有头表+行表、且本次同步配置里确实在跑它
  const docs = DOCS.filter((d) => !d.archive && d.headTable && d.lineTable && types.includes(d.code));
  if (!docs.length) { log('【在册核对】配置里没有需要核对的单据类型,跳过'); return { ok: true, skipped: 'no-doc-types' }; }

  const state = existsSync(STATE) ? readJson(STATE) : {};
  state.presence = state.presence || {};
  const tk = await fetchAppToken(cfg.kingdee);
  if (tk.domain && tk.domain !== cfg.kingdee.domain) cfg.kingdee.domain = tk.domain;
  const token = tk.token;

  const mssql = (await import('mssql')).default;
  // 便于"拿本机脚本核对服务器库"(只读排查/上线前验证):YINJIA_SQL_* 覆盖 config.json 里的库连接。
  // 服务器上的正式运行**不设**这些变量,行为与其它同步脚本一致。
  const dbCfg = {
    server: process.env.YINJIA_SQL_HOST || cfg.database.server,
    port: Number(process.env.YINJIA_SQL_PORT || cfg.database.port || 1433),
    database: process.env.YINJIA_SQL_DB || cfg.database.database,
    user: process.env.YINJIA_SQL_USER || cfg.database.user,
    password: process.env.YINJIA_SQL_PASS || cfg.database.password,
  };
  const pool = new mssql.ConnectionPool({
    server: dbCfg.server, port: dbCfg.port, database: dbCfg.database, user: dbCfg.user,
    password: dbCfg.password, options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  });
  await pool.connect();

  const out = { ok: true, checked: 0, skipped: 0, marked: 0, removed: 0, revived: 0, details: [] };
  try {
    for (const doc of docs) {
      const prev = state.presence[doc.code] || {};
      // ① 廉价预判:只要两个数(总数 / 已审核数)
      const tot = await kingdeeGet(cfg.kingdee, token, doc.listPath, { page: '1', page_size: '1' });
      const aud = await kingdeeGet(cfg.kingdee, token, doc.listPath, { bill_status: 'C', page: '1', page_size: '1' });
      const sig = `${Number(tot.count || 0)}|${Number(aud.count || 0)}`;
      const staleFull = !prev.lastFullAt || (Date.now() - prev.lastFullAt) > FULL_RECHECK_MS;
      if (!full && prev.sig === sig && !staleFull) {
        out.skipped++;
        log(`【在册核对】${doc.label}:金蝶总数 ${Number(tot.count || 0)}(已审核 ${Number(aud.count || 0)})与上轮一致,跳过全量对差`);
        continue;
      }

      // ② 全量对差
      const erp = await pullErpAll(cfg, token, doc, Number(tot.count || 0), log);
      if (!erp) { out.skipped++; continue; }

      const mes = (await new mssql.Request(pool).query(
        `SELECT 单据编号 AS no, 外部数据ID AS extId FROM ${doc.headTable} WHERE 外部数据ID IS NOT NULL`)).recordset;

      const affected = [];
      const alive = [];
      for (const m2 of mes) {
        const st = erp.get(String(m2.extId).trim());
        if (st === undefined) affected.push({ no: m2.no, kind: 'D', erpStatus: '金蝶已无此单' });
        else if (st !== 'C') affected.push({ no: m2.no, kind: 'Z', erpStatus: st });
        else alive.push(m2.no);
      }

      // ③ 安全闸门:命中过多 ⇒ 判定列表取不全,一个都不动
      const limit = Math.max(MIN_HIT_LIMIT, Math.ceil(mes.length * MAX_HIT_RATIO));
      if (affected.length > limit) {
        log(`⚠ 【在册核对】${doc.label}:命中 ${affected.length} 条 > 阈值 ${limit}(MES ${mes.length} 条)⇒ 疑似金蝶列表取不全,本次不处理`);
        out.skipped++;
        continue;
      }

      // ④ 逐条处置
      let softCnt = 0, markCnt = 0;
      for (const a of affected) {
        const trace = await hasTrace(mssql, pool, doc, a.no);
        const what = a.kind === 'D' ? '已删除' : `已作废/已反审核(${a.erpStatus})`;
        if (trace) {
          if (!dryRun) await markGone(mssql, pool, doc, a.no, a.kind);
          out.marked++;
          markCnt++;
          log(`⚠ 【在册核对】${doc.label} ${a.no} 金蝶侧${what},但 MES 已有下游痕迹(${trace})`
            + `⇒ ${dryRun ? '将' : '已'}标记拦截(状态=金蝶已${a.kind === 'D' ? '删除' : '作废'}),请到金蝶核对后人工处置`);
        } else {
          if (!dryRun) {
            await softRemove(mssql, pool, doc, a.no);
            await clearMark(mssql, pool, doc, a.no);
          }
          out.removed++;
          softCnt++;
          log(`【在册核对】${doc.label} ${a.no} 金蝶侧${what}且无任何下游痕迹 ⇒ ${dryRun ? '将' : '已'}软删`
            + `(MES 面板不再出现;若金蝶其实还在,下一轮同步会自动拉回)`);
        }
        out.details.push({ panel: doc.code, docNo: a.no, kind: a.kind, trace, erpStatus: a.erpStatus });
      }

      // ⑤ 自愈:金蝶侧又是已审核的单,清掉历史 D/Z 标记
      for (const no of alive) {
        if (dryRun) continue;
        try { out.revived += await clearMark(mssql, pool, doc, no); } catch { /* 忽略 */ }
      }

      state.presence[doc.code] = {
        sig, lastFullAt: Date.now(), lastRunAt: nowLocal(), mes: mes.length, affected: affected.length,
      };
      out.checked++;
      log(`【在册核对】${doc.label}:金蝶在册 ${erp.size} 条 / MES ${mes.length} 条 / 命中 ${affected.length} 条`
        + `(软删 ${softCnt} / 标记 ${markCnt})`);
    }
  } catch (e) {
    out.ok = false;
    out.error = e.message;
    log(`⚠ 【在册核对】失败(不影响同步):${e.message}`);
  } finally {
    await pool.close();
    try { writeFileSync(STATE, JSON.stringify(state, null, 2), 'utf8'); } catch { /* 状态写不进去不影响结果 */ }
  }
  log(`【在册核对】完成:核对 ${out.checked} 类 / 跳过 ${out.skipped} 类 / 标记拦截 ${out.marked} 条 / 软删 ${out.removed} 条`
    + `${dryRun ? '(dry-run 未写库)' : ''}`);
  return out;
}

/* ---------------- 直接运行(CLI) ---------------- */
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const argOf = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : undefined; };
  runPresenceCheck({
    configPath: argOf('config'),
    dryRun: args.includes('--dry-run'),
    full: args.includes('--full'),
    log: (m) => console.log(`[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${m}`),
  }).catch((e) => { console.error('[FATAL]', e.message || e); process.exitCode = 1; });
}
