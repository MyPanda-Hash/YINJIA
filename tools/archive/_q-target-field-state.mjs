// 一次性探针:结算客户取值 + 待改字段的 hidden 状态(确认改动会出现在查询弹窗里)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

console.log('bd_sale_out.结算客户 取值:', JSON.stringify((await q("SELECT DISTINCT TOP 8 结算客户 v FROM bd_sale_out WHERE ISNULL(结算客户,'')<>''")).map(r => r.v)));
console.log('bd_sale_out.客户 取值:', JSON.stringify((await q("SELECT DISTINCT TOP 8 客户 v FROM bd_sale_out WHERE ISNULL(客户,'')<>''")).map(r => r.v)));

const TARGETS = {
  PU_ORDER: ['币种'],
  SL_RECV: ['业务员', '供应商代码', '供应商'],
  QC_RETURN: ['供应商', '经手人', '退货原因'],
  QC_INSP: ['供应商', '检验员', '暂收单号'],
  PURCHASE_IN: ['仓库', '部门'],
  SO_ORDER: ['客户', '客户编码', '结算客户', '部门', '业务员', '币种'],
  SALE_OUT: ['仓库', '客户', '客户编码', '结算客户'],
};
console.log('\n待改字段的 hidden / visible / place / data_type:');
for (const [pc, labels] of Object.entries(TARGETS)) {
  for (const lb of labels) {
    const r = (await q(`SELECT id, label, col_name, data_type, ref_panel, ref_field, display_field, place, hidden, visible, seq FROM yj_field WHERE panel_code=N'${pc}' AND label=N'${lb}'`))[0];
    console.log(`  ${pc}.${lb}: ` + (r ? `id=${r.id} col=${r.col_name} type=${r.data_type} ref=${r.ref_panel || '-'}.${r.ref_field || '-'}/${r.display_field || '-'} place=${r.place} hidden=${r.hidden} visible=${r.visible} seq=${r.seq}` : '不存在'));
  }
}
await pool.close();
