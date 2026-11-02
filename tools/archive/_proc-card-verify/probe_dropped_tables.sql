/* 确认被追溯查询的表是否已下架(只读) */
SET NOCOUNT ON;
PRINT N'==== @DB = ' + DB_NAME() + N' ====';
SELECT N'qc_mold_insp_head 存在(1/0)' AS 项, CASE WHEN OBJECT_ID(N'dbo.qc_mold_insp_head',N'U') IS NULL THEN 0 ELSE 1 END AS 值
UNION ALL SELECT N'qc_cut_insp_head 存在(1/0)', CASE WHEN OBJECT_ID(N'dbo.qc_cut_insp_head',N'U') IS NULL THEN 0 ELSE 1 END
UNION ALL SELECT N'qc_proc_insp_head 存在(1/0)', CASE WHEN OBJECT_ID(N'dbo.qc_proc_insp_head',N'U') IS NULL THEN 0 ELSE 1 END;
GO
