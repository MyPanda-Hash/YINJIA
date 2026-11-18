/**
 * _test-lineupsert-20261116.mjs —— 验证「明细行按行键合并、保住 identity id」(sync-core.upsertLines)。
 *
 * 为什么要有这个测试:这条逻辑是「下游单据认得出原来那行」的唯一保障,而它的 bug 表现很隐蔽
 * (行 id 悄悄变了,只有已送量/材料码归零)。线上故障见 2026-11-16 分批送料
 * 「送料行不存在或已失效 YJ-20261111-06#11039」。
 *
 * 用法(在 deploy 目录下;事务 + 回滚,不留痕):
 *   $env:YINJIA_SQL_PASS='<库密码>'; node _test-lineupsert-20261116.mjs            # 采购订单 × HSDZ_MES
 *   $env:YINJIA_SQL_DB='HSDZ_MES_TEST'; node _test-lineupsert-20261116.mjs          # 换账套
 *   $env:YINJIA_TEST_PANEL='SO_ORDER'; node _test-lineupsert-20261116.mjs           # 换单据(销售订单)
 *
 * 连接参数也可用 YINJIA_SQL_HOST/PORT/USER 覆盖;**密码只从环境变量取,不写进仓库**。
 *
 * 覆盖:① 原样重写 → 行 id 一个不差(核心);② 改数量 → id 不变、数量已更新;③ 幂等(连跑两次);
 *      ④ ERP 删行 → 只删那行、其余 id 不变;⑤ ERP 加行 → 只多一行、其余 id 不变;
 *      ⑥ 行键算不出来(无行号且无物料)→ 退回"整单删插" mode=replace(宁可换 id 也不错配)。
 */
import mssql from 'mssql';
import { upsertLines } from './sync-core.mjs';

const DB = process.env.YINJIA_SQL_DB || 'HSDZ_MES';
const CFG = {
  server: process.env.YINJIA_SQL_HOST || '127.0.0.1',
  port: Number(process.env.YINJIA_SQL_PORT || 1433),
  database: DB,
  user: process.env.YINJIA_SQL_USER || 'yinjia',
  password: process.env.YINJIA_SQL_PASS || '',
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 60000,
};

/** 两种由金蝶同步的订单:采购订单(物料编码/nvarchar 行号)、销售订单(存货编码/int 行号) */
const PANELS = {
  PU_ORDER: { doc: { code: 'PU_ORDER', label: '采购订单', lineTable: 'bl_pu_order' }, table: 'bl_pu_order', codeCol: '物料编码' },
  SO_ORDER: { doc: { code: 'SO_ORDER', label: '销售订单', lineTable: 'bl_so_order' }, table: 'bl_so_order', codeCol: '存货编码' },
};
const P = PANELS[process.env.YINJIA_TEST_PANEL || 'PU_ORDER'];
const doc = { ...P.doc, lineCodeCol: P.codeCol };
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fails.push(msg); };

async function rows(tx, no) {
  const r = new mssql.Request(tx);
  r.input('no', mssql.NVarChar(100), no);
  return (await r.query(
    `SELECT id, CAST([行号] AS nvarchar(50)) AS seq, [${P.codeCol}] AS 物料编码, 数量
       FROM ${P.table} WHERE 单据编号=@no ORDER BY id`)).recordset;
}

const idsOf = (list) => list.map((r) => Number(r.id)).sort((a, b) => a - b);
const sameIds = (a, b) => idsOf(a).join(',') === idsOf(b).join(',');

async function main() {
  const pool = await mssql.connect(CFG);
  console.log(`[db] ${CFG.server}:${CFG.port}/${DB} · [panel] ${doc.code}`);

  // 找一张 ≥3 行的单据(优先近期的)
  const pick = (await new mssql.Request(pool).query(
    `SELECT TOP 1 单据编号 AS no FROM ${P.table} GROUP BY 单据编号 HAVING COUNT(*) >= 3 ORDER BY 单据编号 DESC`)).recordset[0];
  if (!pick) { console.log(`没有 ≥3 行的${doc.label}可测,跳过`); await pool.close(); return; }
  const no = pick.no;
  console.log(`[case] ${no}`);

  const tx = new mssql.Transaction(pool);
  await tx.begin();
  try {
    const before = await rows(tx, no);
    const hasSeq = (r) => r.seq !== null && r.seq !== undefined && String(r.seq).trim() !== '';
    /** 与 upsertLines 同源的行键(行号优先;没有行号用「物料#本单第几次出现」) */
    const keysOf = (list) => {
      const occ = new Map();
      return list.map((r) => {
        if (hasSeq(r)) return `s:${Number(r.seq)}`;
        const c = String(r.物料编码 ?? '').trim();
        const k = (occ.get(c) || 0) + 1;
        occ.set(c, k);
        return `m:${c}#${k}`;
      });
    };
    // 用「行键 → 行」而不是字面量比,行号在 nvarchar 里是 '1.0000'、int 里是 '1',还要兼容没有行号的老单
    const keyed = (list) => new Map(keysOf(list).map((k, i) => [k, list[i]]));
    const mkLines = (list) => list.map((r) => {
      const l = { 单据编号: no, [P.codeCol]: r.物料编码, 数量: Number(r.数量) };
      if (hasSeq(r)) l.行号 = Number(r.seq);
      return l;
    });

    // ① 原样重写一遍(模拟一次"金蝶改了头字段"触发的整单重写)
    const st1 = await upsertLines(doc, tx, mssql, no, mkLines(before), (m) => console.log(`    [log] ${m}`));
    const after1 = await rows(tx, no);
    ok(st1.mode === 'merge', `① mode=merge(实际 ${st1.mode})`);
    ok(after1.length === before.length, `① 行数不变 ${before.length} → ${after1.length}`);
    ok(sameIds(after1, before), '① **行 id 一个不差**(核心断言)');

    // ② 改数量(ERP 改单:第一行数量 +1)
    const kb = keyed(before);
    const firstKey = keysOf(before)[0];
    const lines2 = mkLines(before).map((l, i) => (i === 0 ? { ...l, 数量: Number(l.数量) + 1 } : l));
    await upsertLines(doc, tx, mssql, no, lines2);
    const after2 = await rows(tx, no);
    ok(sameIds(after2, before), '② 改数量后行 id 不变');
    const changed = keyed(after2).get(firstKey);
    ok(Number(changed.数量) === Number(kb.get(firstKey).数量) + 1, '② 数量已按新值更新');

    // ③ 幂等:同样的数据再写一遍
    await upsertLines(doc, tx, mssql, no, lines2);
    const after3 = await rows(tx, no);
    ok(sameIds(after3, after2), '③ 重复写幂等(行 id 不变)');

    // ④ ERP 删掉一行
    const dropped = before[before.length - 1];
    const st4 = await upsertLines(doc, tx, mssql, no, mkLines(before).slice(0, -1));
    const after4 = await rows(tx, no);
    ok(st4.del === 1 && !after4.some((r) => Number(r.id) === Number(dropped.id)), `④ 删除行已删掉(删 ${st4.del} 行)`);
    ok(after4.every((r) => before.some((b) => Number(b.id) === Number(r.id))), '④ 其余行 id 不变');

    // ⑤ ERP 新增一行(新物料名 ⇒ 行键必然是新键)
    const addedKey = hasSeq(before[0]) ? 9999 : null;
    const addLine = { 单据编号: no, [P.codeCol]: 'TEST-ADDED-' + Date.now(), 数量: 1 };
    if (addedKey !== null) addLine.行号 = addedKey;
    const lines4 = [...mkLines(before).slice(0, -1), addLine];
    const st5 = await upsertLines(doc, tx, mssql, no, lines4);
    const after5 = await rows(tx, no);
    ok(st5.ins === 1, `⑤ 新增 1 行(实际 ${st5.ins})`);
    ok(after5.length === after4.length + 1, `⑤ 行数 +1(${after4.length} → ${after5.length})`);
    ok(after4.every((r) => after5.some((x) => Number(x.id) === Number(r.id))), '⑤ 原有行 id 全部保住');

    // ⑥ 行键算不出来(无行号 + 无物料)→ 只能整单删插
    const st6 = await upsertLines(doc, tx, mssql, no, [{ 单据编号: no, 行号: null, [P.codeCol]: '', 数量: 1 }],
      (m) => console.log(`    [log] ${m}`));
    ok(st6.mode === 'replace', `⑥ 行键算不出来 → mode=replace(实际 ${st6.mode})`);
  } finally {
    await tx.rollback();
    console.log('  · 已回滚,库未改动');
    await pool.close();
  }
  if (fails.length) { console.error(`\n[FAIL] ${fails.length} 项:`); fails.forEach((f) => console.error(' - ' + f)); process.exitCode = 1; }
  else console.log('\n[PASS] 行 id 在所有场景下都被保住');
}

main().catch((e) => { console.error('[FATAL]', e.message || e); process.exitCode = 1; });
