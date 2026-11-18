SET NOCOUNT ON;
PRINT '== qc_return_detail / qc_tc_in_detail / bl_purchase_in 关键列 ==';
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE (TABLE_NAME = 'qc_return_detail' AND (COLUMN_NAME LIKE N'%采购%' OR COLUMN_NAME IN (N'id',N'单据编号')))
   OR (TABLE_NAME = 'qc_tc_in_detail' AND (COLUMN_NAME LIKE N'%采购%' OR COLUMN_NAME LIKE N'%源单%' OR COLUMN_NAME IN (N'id',N'单据编号')))
   OR (TABLE_NAME = 'bl_purchase_in' AND (COLUMN_NAME LIKE N'%采购%' OR COLUMN_NAME LIKE N'%源单%' OR COLUMN_NAME IN (N'id',N'单据编号',N'行号')))
ORDER BY TABLE_NAME, COLUMN_NAME;
GO
PRINT '== 单据内 行号 是否重复 ==';
SELECT TOP 10 单据编号, COUNT(*) AS n FROM bl_pu_order GROUP BY 单据编号 HAVING COUNT(*) <> COUNT(DISTINCT ISNULL(CAST(行号 AS nvarchar(50)), N'')) ORDER BY 单据编号 DESC;
GO
PRINT '== QC_RECV 失效 link 的可回填覆盖 ==';
WITH bad AS (
  SELECT l.id, l.source_form_no, l.target_form_no, l.target_line_key
    FROM form_flow_link l
   WHERE l.source_panel_code = N'PU_ORDER' AND l.target_panel_code = N'QC_RECV'
     AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号 = l.source_form_no
                     AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key)
)
SELECT COUNT(*) AS 失效数,
       SUM(CASE WHEN EXISTS (
             SELECT 1 FROM bad b
             JOIN sl_recv_detail d ON d.单据编号 = b.target_form_no
                  AND N'' + b.target_line_key = b.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
             JOIN bl_pu_order o ON o.单据编号 = b.source_form_no
                  AND LTRIM(RTRIM(CAST(o.行号 AS nvarchar(50)))) = LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50))))
             WHERE b.id = bad.id) THEN 1 ELSE 0 END) AS 可回填
FROM bad;
GO
PRINT '== 目标行 采购订单行号 为空的比例(暂收) ==';
SELECT SUM(CASE WHEN ISNULL(LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50)))),N'') = N'' THEN 1 ELSE 0 END) AS 空行号,
       COUNT(*) AS 总行数
FROM sl_recv_detail d;
