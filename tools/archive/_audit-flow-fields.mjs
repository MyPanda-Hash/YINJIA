/**
 * _audit-flow-fields.mjs — 采购链「明细/表头字段流转」体检(只读,不改数据、不改库)
 *
 * 用途:逐跳列出「来源字段 → 目标字段」的实际映射关系,并把**没过去的字段**按成因分类:
 *   OK_SAME   同名直达
 *   OK_SYN    同义词命中(目标标签与来源不同 → 属于「命名不统一」,建议统一命名)
 *   CAP14     **行映射 14 条上限**被挤掉(映射规则能命中,但代码在 14 条处 break)
 *   CAP7      表头映射 7 条上限被挤掉
 *   NO_FIELD  目标面板没有该字段登记(表列可能有,只是没注册 → 加字段行即可)
 *   NO_COL    目标表没有该列(新增字段未落到下游 → 要补列 + 注册 + 译名)
 *
 * 判定依据与后端一致(PanelConfigService.buildSelectConfig):
 *   · 行映射:先同名(src.fieldsAt("detail") 顺序,累计 14 条即 break),再追加 FLOW_DETAIL_SYNONYMS(无上限)
 *   · 头映射:先同名(累计 7 条即 break,含「来源单号」那条),再追加 FLOW_HEAD_SYNONYMS
 * 用法: node tools/archive/_audit-flow-fields.mjs
 */
import { createRequire } from 'node:module';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';

/* ── 与后端保持一致的两张同义词表(改动后端时同步这里) ── */
const FLOW_DETAIL_SYNONYMS = [
  ['存货名称', '产品名称'], ['存货名称', '材料名称'], ['存货编码', '产品编码'], ['存货编码', '材料编码'],
  ['数量', '实收数量'], ['预计交货日期', '预完工日'], ['计量单位', '销售单位'], ['计量单位', '单位'],
  ['物料编码', '存货编码'], ['物料名称', '存货名称'], ['存货编码', '物料编码'], ['存货名称', '物料名称'],
  ['规格型号', '型号'], ['单位', '计量单位'], ['销售单位', '计量单位'], ['生产单位', '计量单位'],
  ['采购单位', '单位'], ['销售单位', '生产单位'], ['暂收数量', '送检数量'], ['数量', '送检数量'],
  ['合格数量', '实收数量'], ['不合格数量', '退货数量'], ['行号', '采购订单行号'], ['批次号', '批次号'],
  ['存货编码', '产品编码'], ['存货名称', '产品名称'], ['数量', '订单数量'],
];
const FLOW_HEAD_SYNONYMS = {
  'PU_REQ|PU_ORDER': [['建议供应商', '供应商']],
  'PU_ORDER|PURCHASE_IN': [['单据编号', '采购订单号']],
  'PU_ORDER|QC_RECV': [['单据日期', '日期'], ['供应商编码', '供应商代码'], ['单据编号', '采购订单号']],
  'QC_RECV|QC_INSP': [['日期', '日期'], ['采购订单号', '采购订单号'], ['批次号', '批次号']],
  'QC_INSP|PURCHASE_IN': [['单号', '外部单据号'], ['采购订单号', '采购订单号'], ['批次号', '批次号']],
  'QC_INSP|QC_RETURN': [['单据编号', '检验单号'], ['采购订单号', '采购订单号'], ['批次号', '批次号']],
};
const FLOW_HEAD_EXCLUDE = ['编号', '单据状态', '审核人', '审核时间', '审批人', '审批时间', '创建时间', '更新时间',
  '附件1', '附件2', '附件3', '附件4', '附件5', '附件6'];
const DETAIL_CAP = 14, HEAD_CAP = 7;

const CHAIN = [
  { from: 'PU_ORDER', to: 'QC_RECV', name: '采购订单 → 来料暂收单' },
  { from: 'QC_RECV', to: 'QC_INSP', name: '来料暂收单 → 来料检验单' },
  { from: 'QC_INSP', to: 'PURCHASE_IN', name: '来料检验单 → 采购入库单' },
  { from: 'QC_INSP', to: 'QC_RETURN', name: '来料检验单 → 暂收退料单' },
];

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;

/** 面板的表头/明细字段(按 seq;visible 用于判断"界面能看见的字段"是否流转) */
async function fieldsOf(code) {
  const rows = await q(`SELECT col_name, label, place, seq, hidden, visible, data_type FROM yj_field WHERE panel_code='${code}' ORDER BY seq, id`);
  const list = (needle) => rows.filter((r) => String(r.place || '').includes(needle));
  return { all: rows, header: list('header'), detail: list('detail') };
}
const panelRow = async (code) => (await q(`SELECT panel_code, panel_name, mode, line_table, head_table FROM yj_panel WHERE panel_code='${code}'`))[0];
/**
 * 目标面板"表里到底有没有这个列":优先看注册字段的 col_name,再看目标表的物理列。
 * 有些下游表列名与标签不同(如 label 型号 / col 型号),故两处都查。
 */
async function hasColInTarget(targetPanelCode, label) {
  const p = await panelRow(targetPanelCode);
  const candidateCols = [label];
  // 常见异名:型号↔规格型号、单位↔计量单位、存货↔物料
  const alias = { '型号': '规格型号', '规格型号': '型号', '规格': '规格型号', '单位': '计量单位', '计量单位': '单位' };
  if (alias[label]) candidateCols.push(alias[label]);
  for (const t of [p.line_table, p.head_table].filter(Boolean)) {
    for (const c of candidateCols) {
      const hit = await q(`SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' AND COLUMN_NAME=N'${c}'`);
      if (hit.length) return { table: t, col: c };
    }
  }
  return null;
}

console.log('采购链字段流转体检(判定规则与后端 PanelConfigService.buildSelectConfig 一致)\n');
const summary = [];
for (const hop of CHAIN) {
  const src = await fieldsOf(hop.from), tgt = await fieldsOf(hop.to);
  const sp = await panelRow(hop.from), tp = await panelRow(hop.to);
  const tgtDetailLabels = new Set(tgt.detail.map((f) => f.label));
  const tgtHeaderLabels = new Set(tgt.header.map((f) => f.label));
  console.log('='.repeat(96));
  console.log(`■ ${hop.name}   (${hop.from}.${sp.line_table} → ${hop.to}.${tp.line_table})`);

  /* ── 明细:复现后端映射顺序 ── */
  const mapped = new Set();
  const rows = [];
  let capHit = false;
  for (const f of src.detail) {
    const inCap = mapped.size < DETAIL_CAP;
    if (tgtDetailLabels.has(f.label)) {
      if (inCap) { mapped.add(f.label); rows.push({ from: f.label, to: f.label, kind: 'OK_SAME' }); }
      else { capHit = true; rows.push({ from: f.label, to: f.label, kind: 'CAP14' }); }
    }
  }
  for (const [a, b] of FLOW_DETAIL_SYNONYMS) {
    if (!src.detail.some((f) => f.label === a) || !tgtDetailLabels.has(b)) continue;
    if (mapped.has(a) || mapped.has(b)) continue;
    mapped.add(b); rows.push({ from: a, to: b, kind: a === b ? 'OK_SAME' : 'OK_SYN' });
  }
  // 未进映射的来源明细字段(**只报界面可见的**:隐藏的多为 ERP 同步技术列,与"表格数据没流转"无关)
  const unmapped = [], hiddenUnmapped = [];
  for (const f of src.detail) {
    if (rows.some((r) => r.from === f.label)) continue;
    const colHit = await hasColInTarget(hop.to, f.label);
    const item = { label: f.label, visible: f.visible, colHit, kind: colHit ? 'NO_FIELD' : 'NO_COL' };
    (f.visible ? unmapped : hiddenUnmapped).push(item);
  }
  console.log(`  明细 映射上(${rows.filter((r) => r.kind.startsWith('OK')).length} 条,上限 ${DETAIL_CAP}${capHit ? ',**已触上限**' : ''}):`);
  for (const r of rows) console.log(`    ${r.kind.padEnd(8)} ${r.from}${r.from === r.to ? '' : ' → ' + r.to}`);
  if (unmapped.length) {
    console.log(`  明细 未流转【界面可见字段】${unmapped.length} 条:`);
    for (const u of unmapped) {
      const why = u.kind === 'NO_FIELD'
        ? `目标表已有列「${u.colHit.col}」但面板没登记字段`
        : '目标表没有这个列';
      console.log(`    ${u.kind.padEnd(8)} ${u.label}  ← ${why}`);
    }
  }
  if (hiddenUnmapped.length) console.log(`  明细 未流转【隐藏列】${hiddenUnmapped.length} 条(ERP 同步技术列,一般无需流转)`);

  /* ── 表头:复现后端(含「来源单号」占 1 条,上限 7) ── */
  const syn = FLOW_HEAD_SYNONYMS[`${hop.from}|${hop.to}`] || [];
  const hMapped = new Set(), hRows = [];
  let hCapHit = false;
  for (const f of src.header) {
    const l = f.label;
    if (FLOW_HEAD_EXCLUDE.includes(l) || !tgtHeaderLabels.has(l)) continue;
    if (hRows.length + 1 < HEAD_CAP) { hMapped.add(l); hRows.push({ from: l, to: l, kind: 'OK_SAME' }); }
    else { hCapHit = true; hRows.push({ from: l, to: l, kind: 'CAP7' }); }
  }
  for (const [a, b] of syn) {
    if (!src.header.some((f) => f.label === a) || !tgtHeaderLabels.has(b) || hMapped.has(a)) continue;
    hMapped.add(a); hRows.push({ from: a, to: b, kind: a === b ? 'OK_SAME' : 'OK_SYN' });
  }
  console.log(`  表头 映射上(含「来源单号」1 条,上限 ${HEAD_CAP}${hCapHit ? ',**已触上限**' : ''}):`);
  for (const r of hRows) console.log(`    ${r.kind.padEnd(8)} ${r.from}${r.from === r.to ? '' : ' → ' + r.to}`);
  const hUnmapped = [], hHidden = [];
  for (const f of src.header) {
    const l = f.label;
    if (hRows.some((r) => r.from === l) || FLOW_HEAD_EXCLUDE.includes(l)) continue;
    const colHit = await hasColInTarget(hop.to, l);
    (f.visible ? hUnmapped : hHidden).push({ label: l, visible: f.visible, colHit });
  }
  if (hUnmapped.length) {
    console.log(`  表头 未流转【界面可见字段】${hUnmapped.length} 条:`);
    for (const u of hUnmapped) console.log(`    ${u.colHit ? 'NO_FIELD' : 'NO_COL  '} ${u.label}  ← ${u.colHit ? `目标已有列「${u.colHit.col}」但未登记字段` : '目标表无此列'}`);
  }
  if (hHidden.length) console.log(`  表头 未流转【隐藏列】${hHidden.length} 条`);
  summary.push({ hop: hop.name, detailMapped: rows.filter((r) => r.kind.startsWith('OK')).length, detailUnmapped: unmapped.length, detailCap: capHit, headCap: hCapHit, headUnmapped: hUnmapped.length });
}
console.log('\n' + '='.repeat(96));
console.log('汇总:');
for (const s of summary) console.log(`  ${s.hop}: 明细已映射 ${s.detailMapped} / 未流转 ${s.detailUnmapped}${s.detailCap ? ' [触 14 上限]' : ''}${s.headCap ? ' [触 7 上限]' : ''} / 表头未流转 ${s.headUnmapped}`);
await pool.close();
