-- q-02-neighbors.sql — 对照:QC_INSP / QC_RECV 同类字段面(看备注/计量单位是否同名字段)
SELECT panel_code, place, seq, col_name, data_type, ref_panel, ref_field, display_field, editable, hidden, visible
FROM yj_field WHERE panel_code IN (N'QC_INSP', N'QC_RECV') AND col_name IN (N'物料编码', N'物料名称', N'备注', N'计量单位', N'数量', N'来料数量', N'物料批次')
ORDER BY panel_code, place, seq;

PRINT N'=== INV.备注 / INV.计量单位 有值的行数 ===';
SELECT COUNT(*) AS inv_total,
       SUM(CASE WHEN ISNULL(备注, N'') <> N'' THEN 1 ELSE 0 END) AS 备注有值,
       SUM(CASE WHEN ISNULL(计量单位, N'') <> N'' THEN 1 ELSE 0 END) AS 单位有值
FROM bs_inv;

PRINT N'=== 检验数据记录现有单据的物料两列填报情况 ===';
SELECT COUNT(*) AS 报告数,
       SUM(CASE WHEN ISNULL(物料名称, N'') <> N'' THEN 1 ELSE 0 END) AS 名称有值,
       SUM(CASE WHEN ISNULL(物料编码, N'') <> N'' THEN 1 ELSE 0 END) AS 编码有值
FROM qc_insp_rec;
