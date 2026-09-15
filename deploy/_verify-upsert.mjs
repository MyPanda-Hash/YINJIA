// 一次性落库验证:upsertArchive 对 bs_currency 真实写-改-验-删(凭证经 env,结束清理)
// 用法:node deploy/_verify-upsert.mjs
process.env.YINJIA_SQL_PASS = process.env.YINJIA_SQL_PASS || '';
import mssql from 'mssql';
import { DOCS, upsertArchive } from './sync-core.mjs';

const doc = DOCS.find((d) => d.code === 'BD_CUR');
const POOL = {
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES',
  user: process.env.YINJIA_SQL_USER || 'yinjia', password: process.env.YINJIA_SQL_PASS,
  options: { encrypt: false, trustServerCertificate: true },
};

const fake = (over = {}) => ({
  外部数据ID: 'test-currency-9999', 外部单据号: 'TEST_CUR', __创建时间: '2026-01-01 00:00:00',
  编码: 'ZZZ-TEST', 名称: '探针币别', 币别符号: 'Z', 汇率: 1.5, 汇率类型: '固定汇率',
  金额小数位: 2, 单价小数位: 4, 停用: false, 状态: '启用', __cancel: 'N', ...over,
});

async function main() {
  const pool = new mssql.ConnectionPool(POOL);
  await pool.connect();
  try {
    // 1) 插入
    await upsertArchive(doc, mssql, pool, fake(), 'fp-1');
    let row = (await new mssql.Request(pool).query(`SELECT * FROM bs_currency WHERE 外部数据ID='test-currency-9999'`)).recordset[0];
    console.log('[插入] %s %s 汇率=%s 锚点=%s 指纹=%s', row.编码, row.名称, row.汇率, row.外部数据ID, row.外部指纹);
    if (!row || row.外部指纹 !== 'fp-1' || Number(row.汇率) !== 1.5) throw new Error('插入校验失败');
    // 2) 再跑=更新(幂等,不改号)
    await upsertArchive(doc, mssql, pool, fake({ 名称: '探针币别改', 汇率: 2.5, 停用: true, 状态: '停用', __cancel: 'Y' }), 'fp-2');
    row = (await new mssql.Request(pool).query(`SELECT * FROM bs_currency WHERE 外部数据ID='test-currency-9999'`)).recordset[0];
    console.log('[更新] %s 汇率=%s 停用=%s 状态=%s asp_cancel=%s 指纹=%s', row.名称, row.汇率, row.停用, row.状态, row.asp_cancel, row.外部指纹);
    if (row.名称 !== '探针币别改' || Number(row.汇率) !== 2.5 || row.停用 !== true || row.asp_cancel.trim() !== 'Y' || row.外部指纹 !== 'fp-2') throw new Error('更新校验失败');
    const cnt = (await new mssql.Request(pool).query(`SELECT COUNT(*) n FROM bs_currency WHERE 外部数据ID='test-currency-9999'`)).recordset[0].n;
    if (cnt !== 1) throw new Error('幂等失败:出现 ' + cnt + ' 行');
    console.log('[幂等] 行数=%s ✓', cnt);
    // 3) 空锚点按编码匹配收编既有行(模拟手录行被同步接管)
    await new mssql.Request(pool).query(`INSERT INTO bs_currency (编码,名称,状态) VALUES (N'ZZZ-HAND', N'手录币别', N'启用')`);
    await upsertArchive(doc, mssql, pool, fake({ 外部数据ID: 'test-currency-8888', 外部单据号: 'ZZZ-HAND', 编码: 'ZZZ-HAND', 名称: '手录币别-接管' }), 'fp-3');
    row = (await new mssql.Request(pool).query(`SELECT * FROM bs_currency WHERE 编码=N'ZZZ-HAND'`)).recordset[0];
    console.log('[收编] %s 锚点=%s(非空=接管成功)', row.名称, row.外部数据ID);
    if (!row.外部数据ID || row.外部数据ID !== 'test-currency-8888') throw new Error('空锚点收编失败');
    console.log('RESULT: ALL PASS');
  } finally {
    // 清理探针数据
    await new mssql.Request(pool).query(`DELETE FROM bs_currency WHERE 外部数据ID IN ('test-currency-9999','test-currency-8888')`);
    const left = (await new mssql.Request(pool).query(`SELECT COUNT(*) n FROM bs_currency WHERE 编码 LIKE N'ZZZ-%'`)).recordset[0].n;
    console.log('[清理] 残留=%s(期望0)', left);
    await pool.close();
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
