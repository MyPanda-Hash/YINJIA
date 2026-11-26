// 只读:本地账套 供应商=双喜(含双禧) 的全部订单头/行 + 数量 6000/865/5000 的行
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

console.log('== 供应商含「双喜/双禧」');
console.log(await q(`SELECT 供应商, COUNT(*) n, MIN(单据日期) a, MAX(单据日期) b FROM bd_pu_order WHERE 供应商 LIKE N'%双喜%' OR 供应商 LIKE N'%双禧%' GROUP BY 供应商`));

console.log('\n== 该供应商订单头(全部,按日期倒序前 30)');
const heads = await q(`SELECT 单据编号, 单据日期, 供应商, 单据状态, 关闭状态, [入库状态Z部分入库，C全部入库，A未入库] AS 入库状态, 实际出入库状态, 修改时间, 外部指纹
  FROM bd_pu_order WHERE 供应商 LIKE N'%双喜%' OR 供应商 LIKE N'%双禧%' ORDER BY 单据日期 DESC`);
for (const r of heads.slice(0, 30)) console.log(` ${r.单据编号} ${d(r.单据日期)} 状态=${r.单据状态} 关闭=${r.关闭状态} 入库=${r.入库状态} 实入出=${r.实际出入库状态} 改=${r.修改时间} fp=${String(r.外部指纹||'').slice(-20)}`);

console.log('\n== 该供应商订单行');
const lines = await q(`SELECT l.单据编号, l.行号, l.物料编码, l.物料名称, l.数量, l.行已执行数量, l.行未执行数量, l.行入库状态, l.行关闭状态, h.单据日期
  FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号=l.单据编号
  WHERE h.供应商 LIKE N'%双喜%' OR h.供应商 LIKE N'%双禧%' ORDER BY h.单据日期 DESC, l.单据编号, ISNULL(l.行号,0)`);
for (const r of lines.slice(0, 80)) console.log(` ${r.单据编号} 行${r.行号} ${r.物料编码} ${r.物料名称} 数=${r.数量} 已入=${r.行已执行数量} 未入=${r.行未执行数量} 入库=${r.行入库状态} 关闭=${r.行关闭状态} ${d(r.单据日期)}`);

console.log('\n== 近 20 天 数量∈{5000,6000,865} 的订单行');
const q2 = await q(`SELECT l.单据编号, l.行号, l.物料编码, l.物料名称, l.数量, l.行已执行数量, l.行未执行数量, h.供应商, h.单据日期
  FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号=l.单据编号
  WHERE h.单据日期 >= '2026-11-05' AND l.数量 IN (5000,6000,865,1865,5865,6865)
  ORDER BY h.单据日期 DESC, l.单据编号`);
for (const r of q2.slice(0, 60)) console.log(` ${r.单据编号} 行${r.行号} ${r.物料编码} ${r.物料名称} 数=${r.数量} 已入=${r.行已执行数量} 未入=${r.行未执行数量} ${r.供应商} ${d(r.单据日期)}`);

console.log('\n== 物料编码含盖/端盖 的档案(近似的)');
console.log(await q(`SELECT 物料编码, 物料名称, 规格型号 FROM bd_material WHERE 物料名称 LIKE N'%盖%' ORDER BY 物料编码`).then(a=>a.slice(0,40)));
await pool.close();
