SET NOCOUNT ON;
SELECT '目录单位回填' AS k, COUNT(*) AS n FROM qc_catalog_detail WHERE ISNULL(计量单位,N'')<>N''
UNION ALL SELECT '记录单位回填', COUNT(*) FROM qc_insp_rec WHERE ISNULL(计量单位,N'')<>N''
UNION ALL SELECT '特采单位回填', COUNT(*) FROM qc_tc_in WHERE ISNULL(计量单位,N'')<>N''
UNION ALL SELECT '目录数量拆分残留(带单位文本)', COUNT(*) FROM qc_catalog_detail WHERE PATINDEX(N'%[^0-9.]%', 数量+N'#') > 1
UNION ALL SELECT '记录来料数量拆分残留', COUNT(*) FROM qc_insp_rec WHERE PATINDEX(N'%[^0-9.]%', 来料数量+N'#') > 1
UNION ALL SELECT '字段注册', (SELECT COUNT(*) FROM yj_field WHERE col_name=N'计量单位' AND panel_code IN ('QC_CATALOG','QC_INSP_REC','QC_TC_IN'));
GO
