/**
 * _verify-bom-write.mjs — BD_BOM(BOM单)落库自检(2026-10-04)
 *
 * 正式账套 BOM = 0 条 ⇒ 同步器跑通也是空转,upsertArchiveDoc(档案+分录 写库路径)不会被走到。
 * 本探针用官方文档响应示例作夹具,直接调 **同步器自己的** upsertArchiveDoc 落库两次,验证:
 *   ① 头表 1 行 + 分录 N 行 + yj_doc_status 1 行;
 *   ② 幂等:第二次执行不新增重复行(头表仍 1 行、分录不翻倍);
 *   ③ 单据编号/分录/审核状态等关键值正确落地;
 *   ④ 面板 API 能取到头行与分录(引擎侧 head/line 解析正常)。
 * 用后即清:--clean 删除本方夹具行(单据编号以 BOM-KD-VERIFY 开头)。
 * 用法:node _verify-bom-write.mjs [--clean]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOCS, upsertArchiveDoc } from './sync-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
const DOC_NO = 'BOM-KD-VERIFY';
const mssql = (await import('mssql')).default;
const pool = new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433,
  database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
await pool.connect();
const q = async (sql, ...args) => (await new mssql.Request(pool).query(sql)).recordset;

if (process.argv.includes('--clean')) {
  const d1 = await q(`DELETE FROM bs_bom_detail WHERE [单据编号] = N'${DOC_NO}'; SELECT @@ROWCOUNT AS n;`);
  const d2 = await q(`DELETE FROM bs_bom_head WHERE [单据编号] = N'${DOC_NO}'; SELECT @@ROWCOUNT AS n;`);
  const d3 = await q(`DELETE FROM yj_doc_status WHERE panel_code = 'BD_BOM' AND doc_no = N'${DOC_NO}'; SELECT @@ROWCOUNT AS n;`);
  console.log(`清理夹具:分录 ${d1[0].n} / 表头 ${d2[0].n} / 状态 ${d3[0].n} 行`);
  await pool.close();
  process.exit(0);
}

const doc = DOCS.find((d) => d.code === 'BD_BOM');
// 夹具:官方响应示例(与 _verify-bom-map.mjs 同源),单据编号换成可识别的测试号
const SAMPLE = {
  audit_time: '2022-04-01 21:54:47', auditor_name: '张三', billsource: 'PMBD', bom_remark: '备注',
  create_time: '2022-04-01 21:54:47', creator_name: '张三', enable: '1', id: '9900000000000000001', isskip: '1',
  material_entity: [
    { dosage_denominator: '1', dosage_numerator: '1', fixed_loss: 1, id: '9900000000000000002', iskeypieces: '1',
      isrepitem: '0', issue_pattern: 'D', machinepos: 'LOCx1', material_baseunit_id: 'u-1', material_id: '1',
      material_name: '6061铝锭', material_number: 'CL002', material_remark: '备注', material_unit_id: 'u-1',
      scrap: 10, seq: 1, sp_id: '1', sp_name: '仓位A', sp_number: '001', stock_id: '1', stock_name: '成品仓',
      stock_number: 'CK01', unitqty: 1, custom_txt1: '备注1', custom_txt2: '备注2', custom_txt3: '备注3' },
    { dosage_denominator: '1', dosage_numerator: '0.02', fixed_loss: 0, id: '9900000000000000003', iskeypieces: '0',
      isrepitem: '0', issue_pattern: 'A', machinepos: 'LOCx2', material_baseunit_id: 'u-2', material_id: '2',
      material_name: '切削液', material_number: 'CL004', material_remark: '', material_unit_id: 'u-2',
      scrap: 2, seq: 2, sp_id: '2', sp_name: '仓位B', sp_number: '002', stock_id: '2', stock_name: '原料仓',
      stock_number: 'CK02', unitqty: 0.02, custom_txt1: '', custom_txt2: '', custom_txt3: '' },
  ],
  modifier_name: '张三', modify_time: '2022-04-01 21:54:47', number: DOC_NO,
  product_baseunit_name: '件', product_baseunit_number: 'PCS', product_name: '铝棒 Φ80', product_number: 'CP001',
  product_unit_name: '件', product_unit_number: 'PCS', status: 'C', version: 'V1.0', yield: 98,
};
const ctx = { uomNameById: new Map([['u-1', '千克'], ['u-2', '升']]) };
const mapped = {
  ...doc.mapArchive(SAMPLE, ctx),
  外部数据ID: String(SAMPLE.id), 外部单据号: SAMPLE.number, __创建时间: SAMPLE.create_time,
};
const lines = doc.mapLines(SAMPLE, ctx);
const fp = doc.fingerprintOf(SAMPLE);

await upsertArchiveDoc(doc, mssql, pool, mapped, lines, fp);        // 第一次
await upsertArchiveDoc(doc, mssql, pool, mapped, lines, fp);        // 第二次(幂等)

const head = await q(`SELECT TOP 1 * FROM bs_bom_head WHERE [单据编号] = N'${DOC_NO}'`);
const lineRows = await q(`SELECT [行号],[子料编码],[子料名称],[子料单位],[材料用量],[损耗率],[发料方式],[关键件],[发料仓库]
                          FROM bs_bom_detail WHERE [单据编号] = N'${DOC_NO}' ORDER BY [行号]`);
const status = await q(`SELECT shr, shsj, canceled FROM yj_doc_status WHERE panel_code = 'BD_BOM' AND doc_no = N'${DOC_NO}'`);

let fail = 0;
const chk = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) fail++; };

chk(head.length === 1, `表头 1 行(幂等跑两次未重复)${head.length !== 1 ? ' → ' + head.length : ''}`);
chk(lineRows.length === 2, `分录 2 行(未翻倍)${lineRows.length !== 2 ? ' → ' + lineRows.length : ''}`);
chk(status.length === 1 && status[0].shr === '张三', `审核状态镜像:shr=${status[0] && status[0].shr} canceled=${status[0] && status[0].canceled}`);
chk(head[0] && head[0]['产品编码'] === 'CP001' && head[0]['成品率'] === 98 && head[0]['审核状态'] === '已审核' && head[0]['是否启用'] === true,
  `头字段: 产品编码=${head[0]['产品编码']} 成品率=${head[0]['成品率']} 审核状态=${head[0]['审核状态']} 是否启用=${head[0]['是否启用']}`);
chk(head[0] && head[0]['外部指纹'] && head[0]['外部数据ID'] === '9900000000000000001', `外部锚点: id=${head[0]['外部数据ID']} 指纹长度=${String(head[0]['外部指纹']).length}`);
chk(lineRows[0]['子料单位'] === '千克' && lineRows[0]['发料方式'] === '直接领料' && lineRows[0]['关键件'] === true,
  `分录 1: 子料=${lineRows[0]['子料编码']}/${lineRows[0]['子料名称']} 单位=${lineRows[0]['子料单位']}(内码解析) 发料方式=${lineRows[0]['发料方式']} 关键件=${lineRows[0]['关键件']}`);
chk(lineRows[1]['材料用量'] === 0.02 && lineRows[1]['子料单位'] === '升' && lineRows[1]['关键件'] === false,
  `分录 2: 用量=${lineRows[1]['材料用量']} 单位=${lineRows[1]['子料单位']} 关键件=${lineRows[1]['关键件']}`);

console.log(fail === 0 ? '\nRESULT: PASS(夹具行保留,供界面核对;用完执行 node _verify-bom-write.mjs --clean 清理)'
  : `\nRESULT: FAIL-${fail}`);
await pool.close();
process.exit(fail === 0 ? 0 : 1);
