/**
 * _verify-qcinsp-header-dept.mjs — 来料检验单(QC_INSP)表头「部门 + 部门编码」验收探针(2026-10-05)
 *
 * 用户口径:「来料检验单的表头缺少部门与部门编码」+「生单不用带入部门,这个生单是跨部门的」。
 * 本探针断言**四件事**(前两条库,后两条接口):
 *   ① qc_insp 有 部门编码 列(且有中文注明)、yj_field 有 header 位的 部门/部门编码 两行;
 *   ② 部门 = 参照 DEPT.部门名称、部门编码 = 参照 DEPT.部门编码(口径同采购入库单/材料出库单);
 *   ③ 面板配置下发到前端时,两个字段都进 dataSchema.fields 且非 hidden(表头才会渲染);
 *      且 部门 的 refMap 含「部门编码 → 部门编码」——选部门时编码自动带出,不用手抄;
 *   ④ QC_RECV→QC_INSP 的头/行映射**不含** 部门/部门名称/部门编码(跨部门,生单不带);
 *      并实测:暂收单生单出来的检验单,头上部门为空(不是仓库那个部门)。
 *
 * 用法:node tools/archive/_verify-qcinsp-header-dept.mjs        (env: YJ_API 覆盖,默认 8090)
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://127.0.0.1:8090/api';
let fails = 0;
const ok = (c, msg, extra = '') => {
  console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}${extra ? '  ' + extra : ''}`);
  if (!c) fails++;
};

// ---------- 连接(两个账套都跑:正式 + 测试) ----------
const DBS = (process.env.YJ_DBS || 'HSDZ_MES,HSDZ_MES_TEST').split(',');
const pools = {};
for (const db of DBS) {
  pools[db] = await new mssql.ConnectionPool({
    server: '127.0.0.1', port: 1433, database: db, user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
}
const q = async (db, s) => (await new mssql.Request(pools[db]).query(s)).recordset;

// ---------- ① ② 库侧:列 + 字段行 ----------
for (const db of DBS) {
  console.log(`=== ① ${db}:qc_insp.部门编码 列 + yj_field 表头两行 ===`);
  const col = await q(db, `SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_insp') AND name=N'部门编码'`);
  ok(col.length === 1, 'qc_insp.部门编码 列存在');
  const cmt = await q(db, `SELECT ep.value v FROM sys.extended_properties ep
      WHERE ep.major_id=OBJECT_ID('dbo.qc_insp') AND ep.name='MS_Description'
        AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp'), N'部门编码', 'ColumnId')`);
  ok(cmt.length === 1 && String(cmt[0].v || '').includes('部门编码'), 'qc_insp.部门编码 有中文注明', String(cmt[0]?.v || '').slice(0, 40));

  const rows = await q(db, `SELECT id, place, seq, col_name, data_type, ref_panel, ref_field, display_field, hidden, visible
      FROM yj_field WHERE panel_code='QC_INSP' AND place LIKE '%header%' AND col_name IN (N'部门', N'部门编码') ORDER BY seq`);
  ok(rows.length === 2, 'QC_INSP 表头位登记了 部门/部门编码 两行', JSON.stringify(rows.map((r) => `${r.col_name}@${r.seq}`)));
  const dept = rows.find((r) => r.col_name === '部门');
  const code = rows.find((r) => r.col_name === '部门编码');
  ok(!!dept && dept.data_type === '参照' && dept.ref_panel === 'DEPT' && dept.ref_field === '部门名称',
    '部门 = 参照 部门档案(DEPT)· 存名称', dept ? `${dept.data_type}/${dept.ref_panel}.${dept.ref_field}` : '缺失');
  ok(!!code && code.data_type === '参照' && code.ref_panel === 'DEPT' && code.ref_field === '部门编码',
    '部门编码 = 参照 部门档案(DEPT)· 存编码(显示名称)', code ? `${code.data_type}/${code.ref_panel}.${code.ref_field}→${code.display_field}` : '缺失');
  ok(rows.every((r) => !r.hidden && r.visible), '两行都 visible 且非 hidden(表头渲染得出来)');
  const dupHeader = await q(db, `SELECT col_name, COUNT(*) c FROM yj_field
      WHERE panel_code='QC_INSP' AND place LIKE '%header%' GROUP BY col_name HAVING COUNT(*)>1`);
  ok(dupHeader.length === 0, '表头没有同名列重复登记(不重复渲染)', JSON.stringify(dupHeader));
}

// ---------- ③ 面板配置:字段下发 + 参照带回 ----------
console.log('=== ③ 面板配置:表头下发字段 + 参照带回映射 ===');
const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = lj?.data?.token;
ok(!!token, '登录成功(正式账套)');
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
const cfg = (await (await fetch(API + '/px/getPanelConfig?panelCode=QC_INSP', { headers: H })).json()).data;
const fields = (cfg?.dataSchema?.fields || []);
const names = fields.map((f) => f.dataName);
console.log('   表头字段(下发顺序,已滤 hidden):', JSON.stringify(names));
const fDept = fields.find((f) => f.dataName === '部门');
const fCode = fields.find((f) => f.dataName === '部门编码');
ok(!!fDept, 'dataSchema.fields 含 部门');
ok(!!fCode, 'dataSchema.fields 含 部门编码');
ok(!!fDept && fDept.refPanel === 'DEPT' && fDept.refField === '部门名称', '部门 参照指向 DEPT.部门名称', JSON.stringify(fDept || {}));
ok(!!fCode && fCode.refPanel === 'DEPT' && fCode.refField === '部门编码', '部门编码 参照指向 DEPT.部门编码', JSON.stringify(fCode || {}));
const carry = (fDept?.refMap || []).map((m) => `${m.from}→${m.to}`);
ok(carry.includes('部门编码→部门编码'), '选部门时「部门编码」随参照带回(refMap)', JSON.stringify(carry));
// 表单页字段序:后端 metadata.formPages[0].fieldNames(前端 headerFields 按它排序,缺失才回退 seq 序)
const formOrder = String(cfg?.metadata?.formPages?.[0]?.fieldNames || '').split(',').map((s) => s.trim()).filter(Boolean);
ok(formOrder.includes('部门') && formOrder.includes('部门编码'), '表单页字段序(formPages)含两个新字段',
  JSON.stringify(formOrder.filter((n) => n === '部门' || n === '部门编码')));
const iDept = formOrder.indexOf('部门'); const iSup = formOrder.indexOf('供应商代码'); const iInsp = formOrder.indexOf('检验员');
ok(iDept > iSup && iDept < iInsp, '表头位置:落在 供应商代码 之后、检验员 之前', `供应商代码@${iSup} 部门@${iDept} 检验员@${iInsp}`);

// ---------- ④ 链路:跨部门,生单不带部门 ----------
console.log('=== ④ QC_RECV→QC_INSP 链路不带 部门/部门编码(跨部门) ===');
const sel = cfg?.selectConfig || {};
const hmap = (sel.headerMap || []).map((m) => `${m.from}→${m.to}`);
const dmap = (sel.detailMap || []).map((m) => `${m.from}→${m.to}`);
console.log('   选单头映射:', JSON.stringify(hmap));
console.log('   选单行映射:', JSON.stringify(dmap));
const deptKeys = ['部门', '部门名称', '部门编码'];
ok(!hmap.some((m) => deptKeys.includes(m.split('→')[1])), '头映射不含 部门/部门名称/部门编码');
ok(!dmap.some((m) => deptKeys.includes(m.split('→')[1])), '行映射不含 部门/部门名称/部门编码');
ok(hmap.includes('单号→暂收单号') && dmap.includes('数量→送检数量'), '其余映射仍在(不是把整张表清空)', JSON.stringify(hmap.slice(0, 4)));
for (const db of DBS) {
  const leftover = await q(db, `SELECT COUNT(*) c FROM qc_insp i JOIN sl_recv s ON s.单据编号 = i.暂收单号
      WHERE ISNULL(i.部门, N'') <> N'' AND i.部门 = s.部门 AND i.暂收单号 <> N''`);
  ok(leftover[0].c === 0, `${db}:生单成品里没有「检验单部门 = 来源暂收单部门」的残留`, `${leftover[0].c} 张`);
}

// ---------- 收尾 ----------
for (const db of DBS) await pools[db].close();
console.log(`\n=== ${fails === 0 ? 'RESULT: PASS' : 'RESULT: FAIL-' + fails} ===`);
// 不用 process.exit():mssql 连接池关闭后硬退会触发 node 的 libuv 断言(UV_HANDLE_CLOSING),退出码会失真
process.exitCode = fails === 0 ? 0 : 1;
