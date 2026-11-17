/**
 * _test-presence-20261116.mjs —— 「金蝶在册核对」的端到端回归(只在**本机账套**跑,结束逐条还原)。
 *
 * 为什么要:sync-presence.mjs 的两条处置分支(有下游痕迹→标记拦截 / 没痕迹→软删)平时跑不出来
 * (线上数据是干净的,命中 0 条),而它们恰恰是最危险的两段写库逻辑。这里人工造两个"金蝶已删除"的样本:
 *   · 样本 A = 有下游占用的采购订单(把 外部数据ID 改成金蝶不存在的值)⇒ 期望:打标 `erp_close_state='D'`,
 *     **不删**数据;
 *   · 样本 B = 无任何痕迹的采购订单 ⇒ 期望:软删(头/行 asp_cancel='Y')+ 清 外部指纹。
 * 结束无论成败都把样本还原(头行数据 + 标记 + asp_cancel + 外部指纹),不污染本机账套。
 *
 * 用法(在 deploy 目录下;务必先确认 config.json 指向的是**本机**库):
 *   $env:YINJIA_SQL_PASS='<本机库密码>'; node _test-presence-20261116.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mssql from 'mssql';
import { runPresenceCheck } from './sync-presence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
const DB = {
  server: cfg.database.server,
  port: Number(cfg.database.port || 1433),
  database: cfg.database.database,
  user: cfg.database.user,
  password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  requestTimeout: 120000,
};
const FAKE_A = `TEST-GONE-A-${Date.now()}`;
const FAKE_B = `TEST-GONE-B-${Date.now()}`;
const fails = [];
const ok = (c, m) => { console.log(`${c ? '  ✓' : '  ✗'} ${m}`); if (!c) fails.push(m); };

const pool = await mssql.connect(DB);
const q = async (sql, inputs = {}) => {
  const r = new mssql.Request(pool);
  for (const [k, v] of Object.entries(inputs)) r.input(k, v.t, v.v);
  return (await r.query(sql)).recordset;
};

/** 把一个"没有下游痕迹"的采购订单找出来:无占用、无批次台账、无材料码打印 */
async function pickUntraced() {
  const rs = await q(`
    SELECT TOP 1 h.单据编号 AS no FROM bd_pu_order h
     WHERE h.外部数据ID IS NOT NULL AND ISNULL(h.asp_cancel,'N')<>'Y'
       AND NOT EXISTS (SELECT 1 FROM form_flow_link f WHERE f.source_panel_code=N'PU_ORDER' AND f.source_form_no=h.单据编号)
       AND NOT EXISTS (SELECT 1 FROM yj_doc_batch b WHERE b.source_panel_code=N'PU_ORDER' AND b.source_form_no=h.单据编号)
       AND NOT EXISTS (SELECT 1 FROM bd_pu_label l WHERE l.采购订单号=h.单据编号)
       AND EXISTS (SELECT 1 FROM bl_pu_order d WHERE d.单据编号=h.单据编号)`);
  return rs[0] && rs[0].no;
}

/** 把一个"有下游占用"的采购订单找出来 */
async function pickTraced() {
  const rs = await q(`
    SELECT TOP 1 f.source_form_no AS no FROM form_flow_link f
     WHERE f.source_panel_code=N'PU_ORDER' AND f.link_status='ACTIVE'
       AND EXISTS (SELECT 1 FROM bd_pu_order h WHERE h.单据编号=f.source_form_no AND h.外部数据ID IS NOT NULL)
     ORDER BY f.id DESC`);
  return rs[0] && rs[0].no;
}

const backup = [];
async function snapshot(no) {
  const head = (await q(`SELECT * FROM bd_pu_order WHERE 单据编号=@no`, { no: { t: mssql.NVarChar(100), v: no } }))[0];
  const st = (await q(`SELECT * FROM yj_doc_status WHERE panel_code=N'PU_ORDER' AND doc_no=@no`, { no: { t: mssql.NVarChar(100), v: no } }))[0] || null;
  backup.push({ no, extId: head.外部数据ID, fp: head.外部指纹, cancel: head.asp_cancel, status: st });
  return { head, st };
}

async function restoreAll() {
  for (const b of backup) {
    const r = new mssql.Request(pool);
    r.input('no', mssql.NVarChar(100), b.no);
    r.input('ext', mssql.NVarChar(100), b.extId);
    r.input('fp', mssql.NVarChar(200), b.fp);
    r.input('cancel', mssql.NVarChar(1), b.cancel == null ? 'N' : b.cancel);
    await r.query(`UPDATE bd_pu_order SET 外部数据ID=@ext, 外部指纹=@fp, asp_cancel=@cancel WHERE 单据编号=@no`);
    const r2 = new mssql.Request(pool);
    r2.input('no', mssql.NVarChar(100), b.no);
    await r2.query(`UPDATE bl_pu_order SET asp_cancel=N'N' WHERE 单据编号=@no`);
    if (b.status) {
      const r3 = new mssql.Request(pool);
      r3.input('no', mssql.NVarChar(100), b.no);
      r3.input('ecs', mssql.NVarChar(1), b.status.erp_close_state);
      await r3.query(`UPDATE yj_doc_status SET erp_close_state=@ecs WHERE panel_code=N'PU_ORDER' AND doc_no=@no`);
    } else {
      const r3 = new mssql.Request(pool);
      r3.input('no', mssql.NVarChar(100), b.no);
      await r3.query(`DELETE FROM yj_doc_status WHERE panel_code=N'PU_ORDER' AND doc_no=@no`);
    }
    console.log(`  · 已还原 ${b.no}(外部数据ID/外部指纹/asp_cancel/erp_close_state)`);
  }
}

try {
  console.log(`[db] ${DB.server}/${DB.database}  假外部数据ID=${FAKE_A} / ${FAKE_B}`);
  const traced = await pickTraced();
  const untraced = await pickUntraced();
  if (!traced || !untraced) { console.log('本机账套找不到合适的样本(缺"有占用"或"无痕迹"的采购订单),跳过'); }
  else {
    console.log(`[样本] 有痕迹=${traced}  无痕迹=${untraced}`);
    await snapshot(traced);
    await snapshot(untraced);
    // 外部数据ID 上有唯一索引(ux_bd_pu_order_ext_id)⇒ 两个样本必须用不同的假 ID
    for (const [no, fake] of [[traced, FAKE_A], [untraced, FAKE_B]]) {
      const r = new mssql.Request(pool);
      r.input('no', mssql.NVarChar(100), no);
      r.input('fake', mssql.NVarChar(100), fake);
      await r.query(`UPDATE bd_pu_order SET 外部数据ID=@fake WHERE 单据编号=@no`);
    }

    const res = await runPresenceCheck({
      full: true,
      log: (m) => console.log(`    [presence] ${m}`),
    });

    // ① 有痕迹:打标 D,数据还在
    const t1 = await q(`SELECT erp_close_state AS ecs FROM yj_doc_status WHERE panel_code=N'PU_ORDER' AND doc_no=@no`, { no: { t: mssql.NVarChar(100), v: traced } });
    const t2 = await q(`SELECT asp_cancel, 外部数据ID AS ext FROM bd_pu_order WHERE 单据编号=@no`, { no: { t: mssql.NVarChar(100), v: traced } });
    ok(t1[0] && t1[0].ecs === 'D', `① 有痕迹的样本被标记 erp_close_state='D'(实际 ${t1[0] && t1[0].ecs})`);
    ok(t2[0] && String(t2[0].asp_cancel || 'N') !== 'Y', '① 有痕迹的样本**没有**被软删(数据还在)');

    // ② 无痕迹:软删 + 清指纹
    const u1 = await q(`SELECT asp_cancel, 外部指纹 AS fp FROM bd_pu_order WHERE 单据编号=@no`, { no: { t: mssql.NVarChar(100), v: untraced } });
    const u2 = await q(`SELECT TOP 1 asp_cancel AS c FROM bl_pu_order WHERE 单据编号=@no`, { no: { t: mssql.NVarChar(100), v: untraced } });
    ok(u1[0] && u1[0].asp_cancel === 'Y', `② 无痕迹的样本被软删(头 asp_cancel=Y,实际 ${u1[0] && u1[0].asp_cancel})`);
    ok(u1[0] && (u1[0].fp === null), '② 无痕迹的样本 外部指纹 已清空(下一轮可复活)');
    ok(u2[0] && u2[0].c === 'Y', '② 行表也一起软删');

    console.log(`  [统计] 命中 ${(res.details || []).length} 条 / 标记 ${res.marked} / 软删 ${res.removed}`);
  }
} finally {
  await restoreAll();
  await pool.close();
}
if (fails.length) { console.error(`\n[FAIL] ${fails.length} 项:`); fails.forEach((f) => console.error(' - ' + f)); process.exitCode = 1; }
else console.log('\n[PASS] 在册核对两条处置分支都按口径执行,样本已还原');
