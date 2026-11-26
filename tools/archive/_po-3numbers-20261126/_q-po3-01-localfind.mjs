// 只读:本地账套里找「惠州市双禧科技」+ 铜盖/弹盖 的采购订单行,以及该供应商近 30 天全部订单行
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'deploy');
const mssql = createRequire(join(HERE, '_probe.cjs'))('mssql');
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
const pool = await mssql.connect({ ...cfg.database, options: { trustServerCertificate: true } });
const q = async (s) => (await pool.request().query(s)).recordset;

console.log('== 供应商 双禧 在采购订单头里出现次数');
console.log(await q(`SELECT 供应商, COUNT(*) n FROM bd_pu_order WHERE 供应商 LIKE N'%双禧%' GROUP BY 供应商`));

console.log('\n== 该供应商近 40 天订单头');
const heads = await q(`SELECT 单据编号, 单据日期, 供应商, 单据状态, 关闭状态,
  [入库状态Z部分入库，C全部入库，A未入库] AS 入库状态, 实际出入库状态, 修改时间, 外部指纹,
  ISNULL(是否已转ERP,N'') AS 转ERP, ISNULL(ERP单号,N'') AS ERP单号
  FROM bd_pu_order WHERE 供应商 LIKE N'%双禧%' AND 单据日期 >= '2026-10-20'
  ORDER BY 单据日期 DESC`);
for (const r of heads) {
  console.log(` ${r.单据编号} 日期=${r.单据日期?.toISOString?.().slice(0,10) ?? r.单据日期} 状态=${r.单据状态} 关闭=${r.关闭状态} 入库=${r.入库状态} 实入出=${r.实际出入库状态} 改=${r.修改时间} fp=${String(r.外部指纹||'').slice(-24)} 转ERP=${r.转ERP} ${r.ERP单号}`);
}

console.log('\n== 该供应商订单行(数量/金蝶已入库/金蝶未入库/行入库状态)');
const lines = await q(`SELECT l.单据编号, l.行号, l.物料编码, l.物料名称, l.规格型号, l.数量,
  l.行已执行数量, l.行未执行数量, l.行入库状态, l.行执行状态, l.行关闭状态, l.批次号, l.分录序号
  FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号=l.单据编号
  WHERE h.供应商 LIKE N'%双禧%' AND h.单据日期 >= '2026-10-20'
  ORDER BY l.单据编号, ISNULL(l.行号,0)`);
for (const r of lines) {
  console.log(` ${r.单据编号} 行${r.行号}/${r.分录序号} ${r.物料编码} ${r.物料名称} 数=${r.数量} 已入=${r.行已执行数量} 未入=${r.行未执行数量} 入库状态=${r.行入库状态} 行状态=${r.行执行状态} 关闭=${r.行关闭状态}`);
}

console.log('\n== 铜盖/弹盖 全部订单行(不限供应商)');
const mats = await q(`SELECT l.单据编号, l.行号, l.物料编码, l.物料名称, l.数量, l.行已执行数量, l.行未执行数量, l.行入库状态, h.供应商, h.单据日期
  FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号=l.单据编号
  WHERE l.物料编码 IN ('YJ-SX-034','YJ-SX-046') AND h.单据日期 >= '2026-10-20'
  ORDER BY h.单据日期 DESC, l.单据编号, ISNULL(l.行号,0)`);
for (const r of mats) {
  console.log(` ${r.单据编号} 行${r.行号} ${r.物料编码} ${r.物料名称} 数=${r.数量} 已入=${r.行已执行数量} 未入=${r.行未执行数量} 入库=${r.行入库状态} 供应商=${r.供应商} 日期=${r.单据日期?.toISOString?.().slice(0,10) ?? r.单据日期}`);
}
await pool.close();
