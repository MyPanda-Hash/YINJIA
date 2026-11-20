SET NOCOUNT ON;
SELECT STUFF((SELECT N' | ' + CAST(序号 AS varchar(5)) + N'.' + ISNULL(检测元素,N'')
              FROM qc_sample_reg WHERE ISNULL(asp_cancel,N'N') <> N'Y'
              ORDER BY 序号 FOR XML PATH('')), 1, 3, N'') AS seq_order;
SELECT N'可见=' + CAST((SELECT COUNT(*) FROM qc_sample_reg WHERE ISNULL(asp_cancel,N'N')<>N'Y') AS varchar(5))
     + N' 重号=' + CAST((SELECT COUNT(*) FROM (SELECT 序号 FROM qc_sample_reg WHERE ISNULL(asp_cancel,N'N')<>N'Y' GROUP BY 序号 HAVING COUNT(*)>1) d) AS varchar(5))
     + N' 最小=' + CAST((SELECT MIN(序号) FROM qc_sample_reg WHERE ISNULL(asp_cancel,N'N')<>N'Y') AS varchar(5))
     + N' 最大=' + CAST((SELECT MAX(序号) FROM qc_sample_reg WHERE ISNULL(asp_cancel,N'N')<>N'Y') AS varchar(5))
     + N' 合计=' + CAST((SELECT SUM(收费) FROM qc_sample_reg WHERE ISNULL(asp_cancel,N'N')<>N'Y') AS varchar(20));
SELECT N'LOG: ' + script_name + N' @' + CONVERT(varchar(20), applied_at, 120) FROM yj_schema_log WHERE script_name LIKE '%sample-reg-seq%';
