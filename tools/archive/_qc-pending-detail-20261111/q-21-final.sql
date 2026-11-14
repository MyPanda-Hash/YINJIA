SET NOCOUNT ON;
SELECT 检验状态 AS st, COUNT(*) n FROM qc_catalog_detail WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 检验状态;
SELECT (SELECT COUNT(*) FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y') AS 存活检验数据记录,
       (SELECT COUNT(*) FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(来料检验单号,N'')=N'') AS 其中无检验单号,
       (SELECT COUNT(*) FROM v_qc_insp_rec_detail WHERE ISNULL(检验状态,N'')<>N'') AS 视图有状态的记录,
       (SELECT COUNT(*) FROM v_qc_insp_rec_detail) AS 视图总行;
