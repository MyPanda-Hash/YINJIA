/**
 * _test-presence-revive-20261116.mjs —— 回答一个关键问题:
 *   **MES 把一张采购订单软删了(asp_cancel='Y' + 清 外部指纹),金蝶那边其实还在 ⇒ 下一次同步会不会被"堵住"再也回不来?**
 *
 * 结论(本脚本实测):**不会**。同步按 `已知指纹` 判断要不要重写;软删时清了 `外部指纹`,
 * 于是下一轮它必然被判成"有变化" → `upsertDoc` 按 外部数据ID 命中同一行 → `asp_cancel` 写回 'N'
 * → 明细行走 upsertLines 的 UPDATE 分支同样置 'N' ⇒ 单子自己回来,行 id 与已送量都不受影响。
 *
 * 本脚本做的事(只在**本机账套**,结束自动还原):
 *   ① 挑一张本机库里有、且金蝶仍在册的采购订单(id 取本机库最新的一张);
 *   ② 记录它的头/行状态,然后按 sync-presence 软删的口径手工"软删"它;
 *   ③ 直接调 sync-core 的 runCore(临时 config 只跑 PU_ORDER)让真实同步跑一轮;
 *   ④ 断言:头/行 asp_cancel 回到 'N'、外部指纹重新写上、行 id 与占用(已送)完全没变;
 *   ⑤ 无论成败都还原(删掉临时 config;数据由 第③步 同步自己复活,失败则回滚成软删前的样子)。
 *
 * 用法(在 deploy 目录下):
 *   node _test-presence-revive-20261116.mjs
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mssql from 'mssql';
import { runCore } from './sync-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CFG_PATH = join(HERE, 'config.json');
const TMP_CFG = join(HERE, '_tmp-revive-pu-order.json');
const cfg = JSON.parse(readFileSync(CFG_PATH, 'utf8').replace(/^\uFEFF/, ''));

const DB = {
  server: cfg.database.server,
  port: Number(cfg.database.port || 1433),
  database: cfg.database.database,
  user: cfg.database.user,
  password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  requestTimeout: 120000,
};

const fails = [];
const ok = (c, m) => { console.log(`${c ? '  ✓' : '  ✗'} ${m}`); if (!c) fails.push(m); };
const pool = await mssql.connect(DB);
const q = async (sql, inputs = {}) => {
  const r = new mssql.Request(pool);
  for (const [k, v] of Object.entries(inputs)) r.input(k, v.t, v.v);
  return (await r.query(sql)).recordset;
};
const N100 = (v) => ({ t: mssql.NVarChar(100), v });

let no = null;
let before = null;
let softDeleted = false;

try {
  // ① 挑一张本机库里的采购订单(要求:金蝶在册、有行;最近的优先)
  const pick = (await q(`
    SELECT TOP 1 h.单据编号 AS no FROM bd_pu_order h
     WHERE h.外部数据ID IS NOT NULL AND ISNULL(h.asp_cancel,'N')<>'Y'
       AND EXISTS (SELECT 1 FROM bl_pu_order d WHERE d.单据编号=h.单据编号)
     ORDER BY h.单据日期 DESC, h.单据编号 DESC`))[0];
  if (!pick) { console.log('本机账套没有可用样本,跳过'); }
  else {
    no = pick.no;
    before = {
      head: (await q(`SELECT asp_cancel, 外部指纹 FROM bd_pu_order WHERE 单据编号=@no`, { no: N100(no) }))[0],
      ids: (await q(`SELECT id, 行号 FROM bl_pu_order WHERE 单据编号=@no ORDER BY id`, { no: N100(no) })),
      sent: (await q(`SELECT ISNULL(SUM(linked_quantity),0) AS s FROM form_flow_link
                       WHERE source_panel_code=N'PU_ORDER' AND source_form_no=@no AND link_status='ACTIVE'`, { no: N100(no) }))[0],
    };
    console.log(`[样本] ${no}  行数=${before.ids.length}  已送=${before.sent.s}`);

    // ② 按 sync-presence 的软删口径手工造"误删"(头/行 asp_cancel='Y' + 清 外部指纹)
    const r1 = new mssql.Request(pool);
    r1.input('no', mssql.NVarChar(100), no);
    await r1.query(`UPDATE bd_pu_order SET asp_cancel=N'Y', 外部指纹=NULL WHERE 单据编号=@no`);
    const r2 = new mssql.Request(pool);
    r2.input('no', mssql.NVarChar(100), no);
    await r2.query(`UPDATE bl_pu_order SET asp_cancel=N'Y' WHERE 单据编号=@no`);
    softDeleted = true;
    const hidden = (await q(`SELECT asp_cancel FROM bd_pu_order WHERE 单据编号=@no`, { no: N100(no) }))[0];
    ok(hidden.asp_cancel === 'Y', `② 已造"软删"现场(头 asp_cancel=${hidden.asp_cancel})`);

    // ③ 真实同步跑一轮(临时 config 只跑 PU_ORDER,避免整链跑十几分钟)
    const tmp = JSON.parse(JSON.stringify(cfg));
    tmp.sync = { ...(tmp.sync || {}), types: ['PU_ORDER'], confirmThreshold: 100000 };
    writeFileSync(TMP_CFG, JSON.stringify(tmp, null, 2), 'utf8');
    console.log('[③] 跑一轮真实同步(runCore,只 PU_ORDER)…');
    await runCore({ mode: 'incremental', configPath: TMP_CFG, assumeYes: true });

    // ④ 断言:单子回来了,而且行 id / 已送量没动
    const after = {
      head: (await q(`SELECT asp_cancel, 外部指纹 FROM bd_pu_order WHERE 单据编号=@no`, { no: N100(no) }))[0],
      ids: (await q(`SELECT id, 行号 FROM bl_pu_order WHERE 单据编号=@no ORDER BY id`, { no: N100(no) })),
      sent: (await q(`SELECT ISNULL(SUM(linked_quantity),0) AS s FROM form_flow_link
                       WHERE source_panel_code=N'PU_ORDER' AND source_form_no=@no AND link_status='ACTIVE'`, { no: N100(no) }))[0],
    };
    ok(String(after.head.asp_cancel || 'N') !== 'Y', `④ 头表 asp_cancel 回到 '${after.head.asp_cancel}'(不再被软删挡住)`);
    ok(after.head.外部指纹 != null && String(after.head.外部指纹) !== '', '④ 外部指纹 重新写上(指纹跳过不再把它漏掉)');
    ok(after.ids.length === before.ids.length, `④ 行数不变(${before.ids.length} → ${after.ids.length})`);
    ok(before.ids.every((b) => after.ids.some((a) => a.id === b.id && a.行号 === b.行号)), '④ **行 id 全部保持原样**');
    ok(Number(after.sent.s) === Number(before.sent.s), `④ 已送量不变(${before.sent.s} → ${after.sent.s})`);
    softDeleted = false;   // 同步已复活,无需回滚
  }
} finally {
  if (softDeleted && no) {
    // 同步没跑成功(或断网):把现场回滚成软删前的样子,别把本机账套的单子留在隐藏状态
    const r = new mssql.Request(pool);
    r.input('no', mssql.NVarChar(100), no);
    await r.query(`UPDATE bd_pu_order SET asp_cancel=N'N' WHERE 单据编号=@no`);
    const r2 = new mssql.Request(pool);
    r2.input('no', mssql.NVarChar(100), no);
    await r2.query(`UPDATE bl_pu_order SET asp_cancel=N'N' WHERE 单据编号=@no`);
    console.log(`  · 已回滚 ${no} 的软删现场(同步未完成)`);
  }
  if (existsSync(TMP_CFG)) unlinkSync(TMP_CFG);
  await pool.close();
}
if (fails.length) { console.error(`\n[FAIL] ${fails.length} 项:`); fails.forEach((f) => console.error(' - ' + f)); process.exitCode = 1; }
else console.log('\n[PASS] 软删不会堵住同步:清指纹后下一轮按 外部数据ID 原样复活,行 id 与已送量不变');
