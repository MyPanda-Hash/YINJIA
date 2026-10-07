import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;

console.log('=== bs_wh / bs_inv 列名(检查 EXISTS 相关子查询是否有同名列遮蔽)===');
console.log('bs_wh :', (await q("SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('bs_wh') ORDER BY column_id")).map(r=>r.name).join(', '));
console.log('bs_inv:', (await q("SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('bs_inv') ORDER BY column_id")).map(r=>r.name).join(', '));

const WH = '成品仓';
console.log(`\n=== 选仓库=${WH} 后,存货列表应=该仓有流水且在档案的存货 ===`);
// 复刻 ButtonService.ledgerRefOptions 的存货查询
const opt = await q(`SELECT DISTINCT RTRIM(存货) AS 存货 FROM v_stock_ledger WHERE 存货 IS NOT NULL AND RTRIM(存货) <> ''
  AND 仓库 IS NOT NULL AND RTRIM(仓库) <> '' AND 仓库 NOT LIKE N'(未填%'
  AND RTRIM(仓库) = N'${WH}'
  AND EXISTS (SELECT 1 FROM bs_inv i WHERE RTRIM(i.存货名称) = RTRIM(存货) AND ISNULL(i.asp_cancel,'N') <> 'Y') ORDER BY 1`);
console.log(`联动选项返回 ${opt.length} 项:`, opt.map(r=>r.存货).join(' | '));

console.log(`\n=== 真实情况:${WH}(CK03) 的全部流水存货(不过档案交集)===`);
const truth = await q(`SELECT DISTINCT RTRIM(仓库) AS wh, RTRIM(存货) AS item FROM v_stock_ledger WHERE RTRIM(仓库) = N'${WH}' ORDER BY 2`);
console.log(`实际 ${truth.length} 项:`, truth.map(r=>r.item).join(' | '));
await pool.close();
