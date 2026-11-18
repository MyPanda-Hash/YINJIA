/**
 * _audit-erp-po-existence-20261116.mjs —— 核对「金蝶那边已经没有了、MES 这边还留着」的采购订单。
 *
 * 背景(用户提问):2026-11-16 的行 id 根治只保证"行 id 不再变",**没有**处理"整张单在金蝶被删/作废"。
 * 本脚本只**读**:①从金蝶拉全部采购订单(不带状态过滤,另试 作废/未审核);②读 MES(可指向服务器);
 * ③按 `外部数据ID` 对差,报出「只在 MES 有」的单据清单。不改任何数据。
 *
 * 用法(在 deploy 目录下):
 *   $env:YINJIA_SQL_PASS='<库密码>'; $env:YINJIA_SQL_HOST='36.140.66.163'; node _audit-erp-po-existence-20261116.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mssql from 'mssql';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
const DB = {
  server: process.env.YINJIA_SQL_HOST || '127.0.0.1',
  port: Number(process.env.YINJIA_SQL_PORT || 1433),
  database: process.env.YINJIA_SQL_DB || 'HSDZ_MES',
  user: process.env.YINJIA_SQL_USER || 'yinjia',
  password: process.env.YINJIA_SQL_PASS || '',
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 120000,
};

/** 拉金蝶采购订单:不带状态过滤(尽量把草稿/作废也拉回来),翻完所有页 */
async function pullErp(token, extra = {}) {
  const out = [];
  const PAGE = 200;
  for (let page = 1; page <= 60; page++) {
    const data = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/pur_order',
      { page: String(page), page_size: String(PAGE), ...extra });
    const rows = data.rows || [];
    out.push(...rows);
    if (page === 1) console.log(`  列表第 1 页:total_page=${data.total_page} count=${data.count}${Object.keys(extra).length ? ' 过滤=' + JSON.stringify(extra) : ''}`);
    if (page >= Number(data.total_page || 1) || !rows.length) break;
  }
  return out;
}

const pool = await mssql.connect(DB);
try {
  const tk = await fetchAppToken(cfg.kingdee);
  // 官方 app-token 会回一个 IDC 域名,后续请求必须用返回的这个(用配置里的旧域名会 401,实测)
  if (tk.domain && tk.domain !== cfg.kingdee.domain) {
    console.log(`[erp] 改用授权返回的域名 ${tk.domain}`);
    cfg.kingdee.domain = tk.domain;
  }
  const token = tk.token;
  console.log(`[erp] token ok · [db] ${DB.server}/${DB.database}`);

  console.log('[1] 金蝶采购订单(不带 bill_status):');
  const all = await pullErp(token);
  const stDist = {};
  for (const r of all) stDist[r.bill_status] = (stDist[r.bill_status] || 0) + 1;
  console.log(`  共 ${all.length} 条;bill_status 分布=${JSON.stringify(stDist)}`);

  console.log('[2] 金蝶采购订单(试 bill_status=C 已审核 与 Z 作废):');
  let audited = [];
  try { audited = await pullErp(token, { bill_status: 'C' }); console.log(`  C(已审核) ${audited.length} 条`); }
  catch (e) { console.log(`  C 查询失败:${e.message}`); }
  let voided = [];
  for (const z of ['Z', 'V', 'A']) {
    try {
      const r = await pullErp(token, { bill_status: z });
      console.log(`  ${z} ${r.length} 条`);
      if (r.length) voided.push(...r);
    } catch (e) { console.log(`  ${z} 查询失败:${e.message}`); }
  }

  console.log('[3] MES 侧采购订单(头部):');
  const mes = (await new mssql.Request(pool).query(
    `SELECT 外部数据ID AS extId, 单据编号 AS no, 单据日期 AS d, 单据状态 AS st, 审核人 AS aud, 审核时间 AS audAt
       FROM bd_pu_order`)).recordset;
  console.log(`  共 ${mes.length} 条;有外部数据ID ${mes.filter((r) => r.extId).length} 条`);

  const erpIds = new Set(all.map((r) => String(r.id).trim()));
  const erpById = new Map(all.map((r) => [String(r.id).trim(), r]));
  const onlyMes = mes.filter((r) => r.extId && !erpIds.has(String(r.extId).trim()));
  const noExt = mes.filter((r) => !r.extId);
  console.log(`\n[结论] 金蝶已找不到、MES 还留着(按 外部数据ID 对):${onlyMes.length} 条`);
  console.log(`       MES 里没有外部数据ID 的(本地点出来的,不是金蝶来的):${noExt.length} 条`);
  for (const r of onlyMes.slice(0, 25)) {
    console.log(`   · ${r.no}  单据日期=${r.d}  单据状态=${r.st}  审核人=${r.aud || '-'}  外部数据ID=${r.extId}`);
  }
  if (onlyMes.length > 25) console.log(`   ……其余 ${onlyMes.length - 25} 条略`);

  // 第二种口子:MES 已审核,但金蝶侧已不是 C(作废 Z / 被反审核回草稿)
  // 增量同步只拉 bill_status=C ⇒ 这类单会从列表里"消失",MES 里状态不动 ⇒ 仍然可以生单
  const staleAudit = mes.filter((r) => {
    if (!r.extId) return false;
    const e = erpById.get(String(r.extId).trim());
    return e && e.bill_status !== 'C';
  });
  console.log(`\n[第二种口子] MES 仍"已审核"、金蝶侧已不是 C 的单:${staleAudit.length} 条`);
  for (const r of staleAudit.slice(0, 25)) {
    const e = erpById.get(String(r.extId).trim());
    console.log(`   · ${r.no}  MES 状态=${r.st}  金蝶 bill_status=${e.bill_status} close_state=${e.bill_close_state}  金蝶是否仍在列表=是`);
  }
  console.log(`\n[金蝶侧独有(只在金蝶有、MES 没有)] ${all.length - new Set(mes.filter((r) => r.extId).map((r) => String(r.extId).trim())).size} 条`
    + `(其中 Z 作废 ${all.filter((r) => r.bill_status === 'Z').length} 条 —— 作废单本来就不该进 MES)`);
  console.log('       (注:金蝶列表若本身不返回"已删除"的单,这一批就是"金蝶删了、MES 还在"的口子;'
    + '若金蝶把作废单也返回,则它们属于"作废但仍在"——两种都要在 MES 侧拦生单)');
} catch (e) {
  console.error('[FATAL]', e.message || e);
  process.exitCode = 1;
} finally {
  await pool.close();
}
