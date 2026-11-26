// 只读:本地账套 找 YJ-SX-046 行 / 未入库=865 行 / 以及 MES 侧占有(已生单)情况
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'deploy');
const mssql = createRequire(join(HERE, '_probe.cjs'))('mssql');
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
const pool = await mssql.connect({ ...cfg.database, options: { trustServerCertificate: true } });
const q = async (s) => (await pool.request().query(s)).recordset;
const d = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

console.log('== YJ-SX-046 全部订单行');
for (const r of await q(`SELECT l.单据编号, l.行号, l.物料编码, l.物料名称, l.数量, l.行已执行数量, l.行未执行数量, l.行入库状态, h.供应商, h.单据日期
  FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号=l.单据编号 WHERE l.物料编码='YJ-SX-046' ORDER BY h.单据日期 DESC`)) {
  console.log(` ${r.单据编号} 行${r.行号} 数=${r.数量} 已入=${r.行已执行数量} 未入=${r.行未执行数量} 入库=${r.行入库状态} ${r.供应商} ${d(r.单据日期)}`);
}

console.log('\n== 行未执行数量 = 865 / 2612 / 5000 的行(近 40 天)');
for (const r of await q(`SELECT l.单据编号, l.行号, l.物料编码, l.物料名称, l.数量, l.行已执行数量, l.行未执行数量, l.行入库状态, h.供应商, h.单据日期
  FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号=l.单据编号
  WHERE h.单据日期 >= '2026-10-20' AND CAST(l.行未执行数量 AS nvarchar(50)) IN (N'865',N'2612',N'5000') ORDER BY h.单据日期 DESC`)) {
  console.log(` ${r.单据编号} 行${r.行号} ${r.物料编码} 数=${r.数量} 已入=${r.行已执行数量} 未入=${r.行未执行数量} ${r.行入库状态} ${r.供应商} ${d(r.单据日期)}`);
}

console.log('\n== MES 侧占用:form_flow_link 对 YJ-20261111-06 行6 / YJ-20260921-10 行3 的关联');
const cols = await q(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='form_flow_link' ORDER BY ORDINAL_POSITION`);
console.log('form_flow_link 列:', cols.map(c=>c.COLUMN_NAME).join(' | '));

await pool.close();
