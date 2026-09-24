SET NOCOUNT ON;
PRINT '--- qc_tc_in.总数量 类型 ---';
SELECT c.name AS 列, TYPE_NAME(c.system_type_id) AS 类型, c.max_length AS 长度
FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.qc_tc_in') AND c.name IN (N'总数量', N'总数量文本', N'计量单位');
PRINT '--- 三表样例 ---';
SELECT TOP 5 N'目录' AS 表, 数量 AS 值, 计量单位 FROM qc_catalog_detail WHERE ISNULL(计量单位,N'') <> N'';
SELECT TOP 5 N'记录' AS 表, 来料数量 AS 值, 计量单位 FROM qc_insp_rec WHERE ISNULL(计量单位,N'') <> N'';
SELECT TOP 5 N'特采' AS 表, 总数量 AS 值, 计量单位 FROM qc_tc_in WHERE ISNULL(计量单位,N'') <> N'';
PRINT '--- 计量单位 字段注册 ---';
SELECT panel_code, col_name, hidden, visible FROM yj_field WHERE col_name = N'计量单位' AND panel_code IN ('QC_CATALOG','QC_INSP_REC','QC_TC_IN');
