// 复现用户打印的那张出货单:在两个账套里找 XSCK-20270901-00001
import { readFileSync, writeFileSync } from 'node:fs';
import sql from 'mssql';
import { shipNoteHtml } from 'file:///D:/YINJIA-main/frontend/src/business/shipNote.js';

const cfg = JSON.parse(readFileSync('D:/YINJIA-main/deploy/config.json', 'utf8'));
const no = 'XSCK-20270901-00001';
for (const db of ['HSDZ_MES', 'HSDZ_MES_TEST']) {
  const pool = await sql.connect({
    server: cfg.database.server, port: cfg.database.port, user: cfg.database.user,
    password: cfg.database.password, database: db,
    options: { encrypt: false, trustServerCertificate: true },
  });
  const head = (await pool.request().input('no', no).query('SELECT * FROM bd_sale_out WHERE 单据编号=@no')).recordset[0];
  const lines = head ? (await pool.request().input('no', no).query(
    'SELECT * FROM bl_sale_out WHERE 单据编号=@no ORDER BY 行号')).recordset : [];
  await pool.close();
  console.log(db, head ? `找到:客户=${head.客户} 日期=${head.单据日期} 行数=${lines.length}` : '无此单');
  if (!head) continue;
  const doc = { 单据编号: head.单据编号, 单据日期: head.单据日期, 客户: head.客户, 客户编码: head.客户编码, 销售订单号: head.销售订单号 };
  const rows = lines.map((l) => ({
    存货编码: l.存货编码, 存货名称: l.存货名称, 规格型号: l.规格型号, 计量单位: l.计量单位,
    数量: l.数量, 批次号: l.批号, 源单编号: l.源单编号,
  }));
  const html = shipNoteHtml(doc, rows);
  const out = `C:/Users/Lenovo/ego/saleout-shipnote-20261128/shipnote-20270901-${db}.html`;
  writeFileSync(out, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">${html}</body>`, 'utf8');
  console.log('  已生成', out, '长度', html.length);
  console.log('  明细:', rows.map((r) => `${r.存货编码}/${r.计量单位}/${r.数量}/批号=${r.批次号 || '空'}`).join(' | '));
}
