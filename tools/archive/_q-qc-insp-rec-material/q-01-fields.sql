-- q-01-fields.sql — 探针:检验数据记录(QC_INSP_REC)抬头 物料名称/物料编码 现状
SELECT id, place, seq, col_name, label, data_type, ref_panel, ref_field, display_field, editable, required, hidden, visible
FROM yj_field WHERE panel_code = N'QC_INSP_REC' ORDER BY place, seq, id;

PRINT N'=== 其他面板里「物料编码+物料名称」都挂 INV 参照的样例 ===';
SELECT panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, editable, required
FROM yj_field
WHERE col_name IN (N'物料编码', N'物料名称') AND ref_panel = N'INV'
ORDER BY panel_code, place, seq;

PRINT N'=== INV 面板自身字段名 ===';
SELECT col_name, label, data_type, place, seq FROM yj_field WHERE panel_code = N'INV' AND col_name IN (N'存货编码', N'存货名称', N'规格型号', N'计量单位');

PRINT N'=== 检验数据记录抬头样例数据 ===';
SELECT TOP 5 单据编号, 物料名称, 物料编码, 物料批次, 来料数量 FROM qc_insp_rec ORDER BY id DESC;
