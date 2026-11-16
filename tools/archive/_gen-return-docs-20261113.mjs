// 生成器:按「金蝶真实账套字段 + MES 同类单据的显示/隐藏口径」补齐两张退货类单据
//   ① 销售退货单 SALE_IN   ← 金蝶 /jdy/v2/scm/sal_in_bound(基线=销售出库单 SALE_OUT)
//   ② 生产退料单 MATERIAL_RET ← 金蝶 /jdy/v2/scm/inv_pick_ret(基线=材料出库单 MATERIAL_OUT)
// 产物:tools/migrate-return-docs-20261113.sql(表/视图/面板/字段/角色/译名 + 末尾自检)
// 依据:
//   · 结构基线  tools/archive/_ret-docs-20261113/mes-schema-dump.json(只读 dump 自 HSDZ_MES)
//   · 键集差异  tools/archive/_ret-docs-20261113/ret-field-keys.json(金蝶真实账套 6 单明细实测)
//   · 保存接口  销售退货 POST /jdy/v2/scm/sal_in_bound;生产退料 POST /jdy/v2/scm/inv_pick_ret
// 用法: node tools/archive/_gen-return-docs-20261113.mjs  → 覆盖写出 tools/migrate-return-docs-20261113.sql
import { readFileSync, writeFileSync } from 'node:fs';

const dump = JSON.parse(readFileSync(new URL('./_ret-docs-20261113/mes-schema-dump.json', import.meta.url), 'utf8'));
const keys = JSON.parse(readFileSync(new URL('./_ret-docs-20261113/ret-field-keys.json', import.meta.url), 'utf8'));
const out = [];
const w = (s = '') => out.push(s);
const q = (s) => '[' + String(s).replace(/]/g, ']]') + ']';
const lit = (s) => (s === null || s === undefined ? 'NULL' : "N'" + String(s).replace(/'/g, "''") + "'");

// ── 单据规格 ───────────────────────────────────────────────────────────
const DOCS = [
  {
    panel: 'SALE_IN', srcPanel: 'SALE_OUT',
    name: '销售退货单', nameEn: 'Sales Return Note',
    head: 'bd_sale_in', line: 'bl_sale_in', prefix: 'SR',
    srcHead: 'bd_sale_out', srcLine: 'bl_sale_out',
    detailPanel: 'SALE_IN_DETAIL', statsPanel: 'SALE_IN_STATS',
    srcDetailPanel: 'SALE_OUT_DETAIL', srcStatsPanel: 'SALE_OUT_STATS',
    viewDetail: 'v_sale_in_detail', viewStats: 'v_sale_in_stats',
    srcViewDetail: 'v_sale_out_detail', srcViewStats: 'v_sale_out_stats',
    api: 'POST /jdy/v2/scm/sal_in_bound',
    kingdee: '金蝶「销售退货单」sal_in_bound(头 77 键 / 行 102 键,真实账套 96 张)',
    // 金蝶 sal_in_bound 有、销售出库没有的头键:return_reason_name / bill_stock_* / ivc_type …
    extraHeadCols: [{ name: '退货原因', type: 'nvarchar(200)', comment: '销售退货单↔金蝶 sal_in_bound 头键 return_reason_name(退货原因)' }],
    labelRename: { 出库类别: '退货类别' },
    hideCols: [],
    extraFields: [{ col: '退货原因', label: '退货原因', seq: 45, place: 'header', width: 160, type: '文本', editable: 1, required: 0 }],
  },
  {
    panel: 'MATERIAL_RET', srcPanel: 'MATERIAL_OUT',
    name: '生产退料单', nameEn: 'Production Return Note',
    head: 'bd_material_ret', line: 'bl_material_ret', prefix: 'TL',
    srcHead: 'bd_material_out', srcLine: 'bl_material_out',
    detailPanel: 'MATERIAL_RET_DETAIL', statsPanel: 'MATERIAL_RET_STATS',
    srcDetailPanel: 'MATERIAL_OUT_DETAIL', srcStatsPanel: 'MATERIAL_OUT_STATS',
    viewDetail: 'v_material_ret_detail', viewStats: 'v_material_ret_stats',
    srcViewDetail: 'v_material_out_detail', srcViewStats: 'v_material_out_stats',
    api: 'POST /jdy/v2/scm/inv_pick_ret',
    kingdee: '金蝶「生产退料单」inv_pick_ret(头 27 键 / 行 73 键,真实账套 953 张)',
    // 金蝶 inv_pick_ret 是 inv_pick 的**严格子集**(行键完全一致,头少 pick_type/pick_use_*)
    extraHeadCols: [],
    labelRename: { 出库类别: '退料类别' },
    hideCols: ['领料类型', '领料用途名称', '领料用途编码', '领料用途id', '单据标签'],
    extraFields: [],
    // 业务类型是 MES 本地必填(与材料出库单同口径),新建时给个默认值,免得每张单都要手填
    headDefaults: { 业务类型: '生产退料' },
  },
];

// 面板名译名(与同族面板同款 9 语)
const PANEL_I18N = {
  销售退货单: { en: 'Sales Return Note', ja: '販売返品票', ko: '판매 반품 전표', 'zh-TW': '銷售退貨單',
    de: 'Verkaufsrücksendung', es: 'Nota de devolución de ventas', fr: 'Note de retour de vente',
    ru: 'Накладная на возврат продажи', th: 'ใบรับคืนสินค้าขาย', vi: 'Phiếu trả lại hàng bán' },
  销售退货单明细表: { en: 'Sales Return Note Details', ja: '販売返品明細表', ko: '판매 반품 세부 목록',
    'zh-TW': '銷售退貨單明細表', de: 'Verkaufsrücksendung Details', es: 'Detalles de la nota de devolución',
    fr: 'Détails de la note de retour', ru: 'Детали накладной на возврат', th: 'รายละเอียดใบรับคืน', vi: 'Chi tiết phiếu trả lại hàng bán' },
  销售退货单统计表: { en: 'Sales Return Statistics', ja: '販売返品統計表', ko: '판매 반품 통계표',
    'zh-TW': '銷售退貨單統計表', de: 'Verkaufsrücksendung Statistik', es: 'Estadísticas de devoluciones',
    fr: 'Statistiques des retours de vente', ru: 'Статистика возвратов продаж', th: 'สถิติการรับคืน', vi: 'Thống kê trả lại hàng bán' },
  生产退料单: { en: 'Production Return Note', ja: '生産返料票', ko: '생산 반납 전표', 'zh-TW': '生產退料單',
    de: 'Produktionsrückgabe', es: 'Nota de devolución de producción', fr: 'Note de retour de production',
    ru: 'Накладная на возврат производства', th: 'ใบรับคืนการผลิต', vi: 'Phiếu hoàn trả sản xuất' },
  生产退料单明细表: { en: 'Production Return Note Details', ja: '生産返料明細表', ko: '생산 반납 세부 목록',
    'zh-TW': '生產退料單明細表', de: 'Produktionsrückgabe Details', es: 'Detalles de la devolución de producción',
    fr: 'Détails de la note de retour de production', ru: 'Детали накладной возврата производства', th: 'รายละเอียดใบรับคืนการผลิต', vi: 'Chi tiết phiếu hoàn trả sản xuất' },
  生产退料单统计表: { en: 'Production Return Statistics', ja: '生産返料統計表', ko: '생산 반납 통계표',
    'zh-TW': '生產退料單統計表', de: 'Produktionsrückgabe Statistik', es: 'Estadísticas de devolución de producción',
    fr: 'Statistiques des retours de production', ru: 'Статистика возвратов производства', th: 'สถิติการรับคืนการผลิต', vi: 'Thống kê hoàn trả sản xuất' },
  退货类别: { en: 'Return Category', ja: '返品カテゴリ', ko: '반품 분류', 'zh-TW': '退貨類別', de: 'Rückgabekategorie',
    es: 'Categoría de devolución', fr: 'Catégorie de retour', ru: 'Категория возврата', th: 'ประเภทการคืน', vi: 'Loại trả lại' },
  退料类别: { en: 'Return Material Category', ja: '返料カテゴリ', ko: '반납 분류', 'zh-TW': '退料類別',
    de: 'Rückgabematerial-Kategorie', es: 'Categoría de devolución de material', fr: 'Catégorie de retour de matériau',
    ru: 'Категория возврата материала', th: 'ประเภทการคืนวัสดุ', vi: 'Loại hoàn trả vật tư' },
};

// ── 类型 → DDL ────────────────────────────────────────────────────────
function ddlType(c) {
  const t = String(c.type_name).toLowerCase();
  const len = Number(c.max_length);
  switch (t) {
    case 'nvarchar': return len === -1 ? 'nvarchar(max)' : `nvarchar(${len / 2})`;
    case 'varchar': return len === -1 ? 'varchar(max)' : `varchar(${len})`;
    case 'char': return len === -1 ? 'char(max)' : `char(${len})`;
    case 'decimal': case 'numeric': return `decimal(${c.precision},${c.scale})`;
    case 'datetime2': return 'datetime2';
    case 'datetime': return 'datetime';
    case 'date': return 'date';
    case 'int': return 'int';
    case 'bigint': return 'bigint';
    case 'smallint': return 'smallint';
    case 'bit': return 'bit';
    case 'money': return 'money';
    case 'float': return 'float';
    default: throw new Error('未支持的类型:' + t);
  }
}
const dedupe = (cols) => {
  const seen = new Map();
  for (const c of cols) if (!seen.has(c.column_id)) seen.set(c.column_id, c);
  return [...seen.values()];
};

// 字段标签(用于无源注释时兜底写中文注明)
const labelOf = (panel, colName) => {
  const p = dump.panels[panel];
  const hit = p?.fields.find((f) => String(f.col_name) === String(colName));
  return hit?.label ?? null;
};

// ── 文件头 ────────────────────────────────────────────────────────────
w('/* ============================================================');
w('   migrate-return-docs-20261113.sql — 2026-11-13');
w('   补齐两张「金蝶有、MES 没有」的退货类单据(用户口径 2026-11-13:');
w('   「销售退货 sal_in_bound 和 生产退料 inv_pick_ret … 根据金蝶erp的字段,和mes其他单据');
w('    对这两个单据的字段显示和隐藏,补齐这两个单,并且测试转erp」)');
w('');
w('   ① 销售退货单  SALE_IN       / bd_sale_in       + bl_sale_in       (SR 号)');
w('   ② 生产退料单  MATERIAL_RET  / bd_material_ret + bl_material_ret (TL 号)');
w('   各带 明细表(_DETAIL)/统计表(_STATS) 两个视图面板,口径对齐「其他入库单/其他出库单」。');
w('');
w('   字段基线(不是凭印象):');
w('     · 销售退货 = 销售出库(bd_sale_out/bl_sale_out,金蝶 sal_out_bound 接口并集)的整表克隆;');
w('       金蝶 sal_in_bound 相对 sal_out_bound 的**新增头键**只有 return_reason_name 一族 + bill_stock_*');
w('       + ivc_type/cus_*;本脚本只补「退货原因」一列(其余 id/发票/客户承担费用族不参与 MES 业务)。');
w('     · 生产退料 = 材料出库(bd_material_out/bl_material_out,金蝶 inv_pick 接口并集)的整表克隆;');
w('       金蝶 inv_pick_ret **是 inv_pick 的严格子集**(行键完全一致,头只少 pick_type/pick_use_*),');
w('       故不补列,只把 MES 独有的「领料类型/领料用途/单据标签」隐藏。');
w('     · 键集证据 tools/archive/_ret-docs-20261113/ret-field-keys.json(真实账套 6 单逐键实测);');
w('       结构 dump  tools/archive/_ret-docs-20261113/mes-schema-dump.json。');
w('');
w('   幂等:IF OBJECT_ID 守卫 + NOT EXISTS;两账套都执行(DbSync 按内容哈希登记)。');
w('   生成器:tools/archive/_gen-return-docs-20261113.mjs(改规格后重跑,勿手改本文件)。');
w('   ============================================================ */');
w('SET NOCOUNT ON;');
w('GO');

// ── 表结构 ────────────────────────────────────────────────────────────
for (const d of DOCS) {
  for (const [src, dst] of [[d.srcHead, d.head], [d.srcLine, d.line]]) {
    const cols = dedupe(dump.tables[src]);
    const extra = src === d.srcHead ? d.extraHeadCols : [];
    w('');
    w(`-- ① 表 ${dst}(${d.name}${src === d.srcHead ? '头' : '明细'};结构 = ${src} 克隆${extra.length ? ' + 金蝶新增键' : ''})`);
    w(`IF OBJECT_ID(N'dbo.${dst}', N'U') IS NULL`);
    w(`CREATE TABLE dbo.${dst} (`);
    const parts = cols.map((c) => {
      let line = `    ${q(c.name)} ${ddlType(c)}${c.is_nullable ? ' NULL' : ' NOT NULL'}`;
      if (c.is_identity) line += ' IDENTITY(1,1)';
      return line;
    });
    for (const e of extra) parts.push(`    ${q(e.name)} ${e.type} NULL`);
    parts.push('    CONSTRAINT ' + q('pk_' + dst) + ' PRIMARY KEY CLUSTERED (' + q('id') + ')');
    w(parts.join(',\n'));
    w(');');
    w('GO');
    // 索引:单据编号(与源表同名口径)
    w(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_${dst}_单据编号' AND object_id = OBJECT_ID(N'dbo.${dst}'))`);
    w(`    CREATE NONCLUSTERED INDEX ${q('IX_' + dst + '_单据编号')} ON dbo.${dst} (${q('单据编号')});`);
    w('GO');
    // 中文注明:沿用源表注释;源表没注释的(多为金蝶拉取列)按面板标签兜底
    const tableComment = `${d.name}${src === d.srcHead ? '头表' : '明细表'}(2026-11-13 按金蝶 ${d.kingdee} 与 MES ${dump.panels[d.srcPanel].panel.panel_name} 结构克隆)`;
    w(`IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.${dst}') AND minor_id = 0 AND name = 'MS_Description')`);
    w(`    EXEC sp_addextendedproperty N'MS_Description', ${lit(tableComment)}, N'SCHEMA', N'dbo', N'TABLE', N'${dst}';`);
    for (const c of cols) {
      const comment = c.comment || (labelOf(d.srcPanel, c.name) ? `${d.name}·${labelOf(d.srcPanel, c.name)}` : `${d.name}·${c.name}`);
      w(`IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.${dst}') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.${dst}'), N'${String(c.name).replace(/'/g, "''")}', 'ColumnId') AND name = 'MS_Description')`);
      w(`    EXEC sp_addextendedproperty N'MS_Description', ${lit(comment)}, N'SCHEMA', N'dbo', N'TABLE', N'${dst}', N'COLUMN', N'${c.name}';`);
    }
    for (const e of extra) {
      w(`IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.${dst}') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.${dst}'), N'${e.name}', 'ColumnId') AND name = 'MS_Description')`);
      w(`    EXEC sp_addextendedproperty N'MS_Description', ${lit(e.comment)}, N'SCHEMA', N'dbo', N'TABLE', N'${dst}', N'COLUMN', N'${e.name}';`);
    }
    w('GO');
  }
}

// ── 视图(改自源视图,只换名字)────────────────────────────────────────
for (const d of DOCS) {
  for (const [srcV, dstV] of [[d.srcViewDetail, d.viewDetail], [d.srcViewStats, d.viewStats]]) {
    const def = dump.views[srcV];
    if (!def) throw new Error('缺视图定义:' + srcV);
    let body = def
      .replace(new RegExp(srcV, 'g'), dstV)
      .replace(new RegExp(d.srcHead, 'g'), d.head)
      .replace(new RegExp(d.srcLine, 'g'), d.line)
      .replace(new RegExp(d.srcDetailPanel ? "panel_code='" + d.srcPanel + "'" : '', 'g'), "panel_code='" + d.panel + "'");
    // panel_code 常量替换(视图里 join yj_doc_status 与统计表的 WHERE 各一处)
    body = body.replaceAll("'" + d.srcPanel + "'", "'" + d.panel + "'");
    w('');
    w(`-- ② 视图 ${dstV}(= ${srcV} 改表名/面板码)`);
    w(`IF OBJECT_ID(N'dbo.${dstV}', N'V') IS NOT NULL DROP VIEW dbo.${dstV};`);
    w('GO');
    w(body.replace(/CREATE\s+VIEW\s+/, 'CREATE VIEW '));
    w('GO');
  }
}

// ── 面板 ──────────────────────────────────────────────────────────────
const panelCols = dump.meta.yj_panel_cols;
const insertPanel = (row) => {
  const cols = panelCols.join(', ');
  const vals = panelCols.map((c) => {
    const v = row[c];
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    return "N'" + String(v).replace(/'/g, "''") + "'";
  }).join(', ');
  w(`IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'${row.panel_code}')`);
  w(`INSERT INTO yj_panel (${cols}) VALUES (${vals});`);
};

const SPECS = [];
for (const d of DOCS) {
  SPECS.push({ ...d, kind: 'head' });
}
for (const d of DOCS) {
  // 明细表 / 统计表面板(数据源 = 视图,单表平铺)
  const srcDetail = dump.panels[d.srcDetailPanel].panel;
  const srcStats = dump.panels[d.srcStatsPanel].panel;
  // ⚠ 必须显式覆盖 panel:doc 规格里的 panel 是**主面板码**,子面板若沿用会把明细/统计字段
  //   全灌进主面板(2026-11-13 踩过:MATERIAL_RET 的明细列里混进「主单位/数量(主单位)」,
  //   列表查询直接 SQL 报「列名'主单位'无效」)。
  SPECS.push({ ...d, kind: 'detail', panel: d.detailPanel, row: { ...srcDetail, panel_code: d.detailPanel, panel_name: d.name + '明细表',
    panel_name_en: (d.nameEn + ' Details'), line_table: d.viewDetail } });
  SPECS.push({ ...d, kind: 'stats', panel: d.statsPanel, row: { ...srcStats, panel_code: d.statsPanel, panel_name: d.name + '统计表',
    panel_name_en: (d.nameEn + ' Statistics'), line_table: d.viewStats } });
}

w('');
w('-- ③ 面板(yj_panel):主面板 2 张 + 明细表/统计表 4 张');
for (const s of SPECS) {
  if (s.kind === 'head') {
    const src = dump.panels[s.srcPanel].panel;
    insertPanel({ ...src, panel_code: s.panel, panel_name: s.name, panel_name_en: s.nameEn,
      head_table: s.head, line_table: s.line, prefix: s.prefix, category: '库存核算', module_group: 'WMS管理',
      group_col: '单据编号', pk_col: 'id', code_col: '单据编号', date_col: '单据日期', config: null });
  } else {
    insertPanel(s.row);
  }
  // 新建默认值(yj_panel.config.headDefaults):只在原 config 为空时写入,不覆盖人工配置
  if (s.kind === 'head' && s.headDefaults) {
    const json = JSON.stringify({ headDefaults: s.headDefaults }).replace(/'/g, "''");
    w(`UPDATE yj_panel SET config = N'${json}' WHERE panel_code = N'${s.panel}' AND (config IS NULL OR LTRIM(RTRIM(config)) = N'');`);
  }
}
w('GO');

// ── 字段(yj_field 克隆)────────────────────────────────────────────────
const fieldCols = dump.meta.yj_field_cols.filter((c) => c !== 'id');
w('');
w('-- ④ 面板字段(yj_field):逐行克隆源面板,再按金蝶键集做改名/隐藏/补列');
for (const s of SPECS) {
  const srcPanel = s.kind === 'head' ? s.srcPanel : s.kind === 'detail' ? s.srcDetailPanel : s.srcStatsPanel;
  const rows = dump.panels[srcPanel].fields;
  w(`-- ${s.panel}  ← 克隆自 ${srcPanel}(${rows.length} 行)`);
  for (const r of rows) {
    const row = { ...r, panel_code: s.panel };
    if (s.kind === 'head') {
      if (s.labelRename && s.labelRename[r.col_name]) row.label = s.labelRename[r.col_name];
      if (s.hideCols && s.hideCols.includes(r.col_name)) { row.hidden = 1; row.visible = 0; }
    }
    const cols = fieldCols.join(', ');
    const vals = fieldCols.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return String(v);
      if (typeof v === 'boolean') return v ? '1' : '0';
      return "N'" + String(v).replace(/'/g, "''") + "'";
    }).join(', ');
    w(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'${row.panel_code}' AND col_name = N'${String(r.col_name).replace(/'/g, "''")}')`);
    w(`INSERT INTO yj_field (${cols}) VALUES (${vals});`);
  }
  // 补列(金蝶有、源面板没有)
  if (s.kind === 'head') {
    for (const f of s.extraFields ?? []) {
      w(`-- ${s.panel} 补列:${f.label}(金蝶键)`);
      w(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'${s.panel}' AND col_name = N'${f.col}')`);
      w(`INSERT INTO yj_field (${fieldCols.join(', ')}) VALUES (` + fieldCols.map((c) => {
        const v = {
          panel_code: s.panel, col_name: f.col, label: f.label, data_type: f.type,
          dict_sql: null, ref_panel: null, ref_field: null, display_field: null,
          place: f.place, seq: f.seq, width: f.width, editable: f.editable, required: f.required,
          hidden: 0, alias: null, visible: 1, label_en: null, col_group: null, ref_filter: null, tab_key: null,
        }[c];
        return v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : "N'" + String(v).replace(/'/g, "''") + "'";
      }).join(', ') + ');');
    }
  }
}
w('GO');

// ── 角色权限(yj_role_panel)──────────────────────────────────────────
const rpCols = dump.meta.yj_role_panel_cols.filter((c) => c !== 'id');
w('');
w('-- ⑤ 角色权限(yj_role_panel):与源面板同权(管理员/车间/仓库等角色照旧可见可审)');
for (const s of SPECS) {
  const srcPanel = s.kind === 'head' ? s.srcPanel : s.kind === 'detail' ? s.srcDetailPanel : s.srcStatsPanel;
  for (const r of dump.panels[srcPanel].roles) {
    w(`IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = ${r.role_id} AND panel_code = N'${s.panel}')`);
    w(`INSERT INTO yj_role_panel (${rpCols.join(', ')}) VALUES (` + rpCols.map((c) => {
      const v = c === 'panel_code' ? s.panel : r[c];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return String(v);
      return "N'" + String(v).replace(/'/g, "''") + "'";
    }).join(', ') + ');');
  }
}
w('GO');

// ── 译名(yj_translation)─────────────────────────────────────────────
w('');
w('-- ⑥ 译名(yj_translation):面板名 + 本次新增/改名的字段标签(9 语)');
for (const [refKey, map] of Object.entries(PANEL_I18N)) {
  const scope = PANEL_I18N[refKey] && refKey.match(/^销售退货单|^生产退料单/) ? 'panel' : 'field';
  const realScope = ['销售退货单', '销售退货单明细表', '销售退货单统计表', '生产退料单', '生产退料单明细表', '生产退料单统计表'].includes(refKey) ? 'panel' : 'field';
  for (const [locale, text] of Object.entries(map)) {
    w(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'${realScope}' AND ref_key = N'${refKey}' AND locale = N'${locale}')`);
    w(`INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'${realScope}', N'${refKey}', N'${locale}', ${lit(text)}, N'manual');`);
  }
}
w('GO');

// ── 自检 ──────────────────────────────────────────────────────────────
w('');
w('-- ⑦ 自检(全 PASS 才算迁移成功)');
w(`DECLARE @chk TABLE(项 nvarchar(60), 期望 int, 实际 int);
INSERT @chk SELECT N'table bd_sale_in', 1, COUNT(*) FROM sys.tables WHERE name = 'bd_sale_in';
INSERT @chk SELECT N'table bl_sale_in', 1, COUNT(*) FROM sys.tables WHERE name = 'bl_sale_in';
INSERT @chk SELECT N'table bd_material_ret', 1, COUNT(*) FROM sys.tables WHERE name = 'bd_material_ret';
INSERT @chk SELECT N'table bl_material_ret', 1, COUNT(*) FROM sys.tables WHERE name = 'bl_material_ret';
INSERT @chk SELECT N'view v_sale_in_detail', 1, COUNT(*) FROM sys.views WHERE name = 'v_sale_in_detail';
INSERT @chk SELECT N'view v_material_ret_stats', 1, COUNT(*) FROM sys.views WHERE name = 'v_material_ret_stats';
INSERT @chk SELECT N'panel SALE_IN', 1, COUNT(*) FROM yj_panel WHERE panel_code = 'SALE_IN';
INSERT @chk SELECT N'panel MATERIAL_RET', 1, COUNT(*) FROM yj_panel WHERE panel_code = 'MATERIAL_RET';
INSERT @chk SELECT N'fields SALE_IN > 200', 1, CASE WHEN (SELECT COUNT(*) FROM yj_field WHERE panel_code='SALE_IN') > 200 THEN 1 ELSE 0 END;
INSERT @chk SELECT N'fields MATERIAL_RET > 100', 1, CASE WHEN (SELECT COUNT(*) FROM yj_field WHERE panel_code='MATERIAL_RET') > 100 THEN 1 ELSE 0 END;
INSERT @chk SELECT N'translations SALE_IN 9', 1, CASE WHEN (SELECT COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key=N'销售退货单') >= 9 THEN 1 ELSE 0 END;
SELECT 项, 期望, 实际, CASE WHEN 期望 = 实际 THEN N'PASS' ELSE N'FAIL' END AS 结果 FROM @chk;
SELECT CASE WHEN EXISTS (SELECT 1 FROM @chk WHERE 期望 <> 实际) THEN N'RESULT: FAIL' ELSE N'RESULT: ALL-PASS' END AS 结论;`);
w('GO');

writeFileSync(new URL('../migrate-return-docs-20261113.sql', import.meta.url), out.join('\n'), 'utf8');
console.log('写出 tools/migrate-return-docs-20261113.sql,行数 =', out.length);
