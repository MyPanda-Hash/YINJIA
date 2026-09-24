SET NOCOUNT ON;
PRINT '== 拼合后样例 ==';
SELECT TOP 4 单据编号, 物料名称, 数量 FROM qc_catalog_detail ORDER BY id DESC;
SELECT TOP 4 单据编号, 来料数量 FROM qc_insp_rec ORDER BY id DESC;
SELECT TOP 4 单据编号, 总数量 FROM qc_tc_in WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
SELECT '未拼残留(目录)' AS k, COUNT(*) AS n FROM qc_catalog_detail WHERE ISNULL(计量单位,N'')<>N'' AND PATINDEX(N'%[^0-9.]%', 数量+N'#')=LEN(数量)+1
UNION ALL SELECT '未拼残留(记录)', COUNT(*) FROM qc_insp_rec WHERE ISNULL(计量单位,N'')<>N'' AND PATINDEX(N'%[^0-9.]%', 来料数量+N'#')=LEN(来料数量)+1
UNION ALL SELECT '未拼残留(特采)', COUNT(*) FROM qc_tc_in WHERE ISNULL(计量单位,N'')<>N'' AND PATINDEX(N'%[^0-9.]%', 总数量+N'#')=LEN(总数量)+1;
GO
