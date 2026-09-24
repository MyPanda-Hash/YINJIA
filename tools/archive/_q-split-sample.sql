SET NOCOUNT ON;
PRINT '== 拆分样例:单位非空行的数量是否纯数值 ==';
SELECT TOP 5 单据编号, 物料名称, 数量, 计量单位 FROM qc_catalog_detail WHERE ISNULL(计量单位,N'')<>N'' ORDER BY id DESC;
SELECT TOP 5 单据编号, 来料数量, 计量单位 FROM qc_insp_rec WHERE ISNULL(计量单位,N'')<>N'' ORDER BY id DESC;
SELECT TOP 5 单据编号, 总数量, 计量单位 FROM qc_tc_in WHERE ISNULL(计量单位,N'')<>N'' ORDER BY id DESC;
GO
