import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;

// 逐仓对比:后端联动 SQL(复刻) vs 视图真实流水
const whs = await q("SELECT DISTINCT RTRIM(仓库) AS wh FROM v_stock_ledger WHERE 仓库 IS NOT NULL AND RTRIM(仓库)<>'' AND 仓库 NOT LIKE N'(未填%' ORDER BY 1");
let problems = 0;
for (const { wh } of whs) {
  const optSql = `SELECT DISTINCT RTRIM(存货) AS v FROM v_stock_ledger WHERE 存货 IS NOT NULL AND RTRIM(存货)<>'' AND 仓库 IS NOT NULL AND RTRIM(仓库)<>'' AND 仓库 NOT LIKE N'(未填%' AND RTRIM(仓库) = N'${wh.replace(/'/g,"''")}' AND EXISTS (SELECT 1 FROM bs_inv i WHERE RTRIM(i.存货名称)=RTRIM(存货) AND ISNULL(i.asp_cancel,'N')<>'Y')`;
  const trueSql = `SELECT DISTINCT RTRIM(存货) AS v FROM v_stock_ledger WHERE RTRIM(仓库) = N'${wh.replace(/'/g,"''")}'`;
  const opt = (await q(optSql)).map(r=>r.v);
  const truth = (await q(trueSql)).map(r=>r.v);
  const dropped = truth.filter(x=>!opt.includes(x));
  const extra = opt.filter(x=>!truth.includes(x));
  if (dropped.length || extra.length) {
    problems++;
    console.log(`【${wh}】选项 ${opt.length} / 真实 ${truth.length}`);
    if (dropped.length) console.log(`   漏掉(有流水但不在选项): ${dropped.join(' | ')}`);
    if (extra.length)  console.log(`   多出(无流水却出现在选项): ${extra.join(' | ')}`);
  } else {
    console.log(`【${wh}】一致(${opt.length} 项)`);
  }
}
console.log(problems ? `\n${problems} 个仓库的约束不一致` : '\n所有仓库约束一致');
await pool.close();
