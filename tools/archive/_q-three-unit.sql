SET NOCOUNT ON;
PRINT '== ① 三表单位/数量物理列 ==';
SELECT OBJECT_NAME(c.object_id) AS tbl, c.name AS col FROM sys.columns c
 WHERE c.object_id IN (OBJECT_ID('qc_catalog_detail'), OBJECT_ID('qc_insp_rec_detail'), OBJECT_ID('qc_tc_in'))
   AND (c.name LIKE N'%单位%' OR c.name LIKE N'%数量%');
PRINT '== ② 三面板单位/数量字段注册 ==';
SELECT panel_code, col_name, place, hidden, visible FROM yj_field
 WHERE panel_code IN ('QC_CATALOG','QC_INSP_REC','QC_TC_IN') AND (col_name LIKE N'%单位%' OR col_name IN (N'数量',N'送检数量',N'总数量',N'来料数量'))
 ORDER BY panel_code, col_name;
PRINT '== ③ 检验目录明细样例(最近3行) ==';
SELECT TOP 3 单据编号, 物料名称, 批次号, 数量 FROM qc_catalog_detail ORDER BY id DESC;
PRINT '== ④ 检验数据记录明细样例 ==';
SELECT TOP 3 单据编号, 物料名称, 来料数量 FROM qc_insp_rec_detail ORDER BY id DESC;
PRINT '== ⑤ 特采单样例 ==';
SELECT TOP 3 单据编号, 总数量 FROM qc_tc_in WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
