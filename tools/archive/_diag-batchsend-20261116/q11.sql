SET NOCOUNT ON;
PRINT '== 目标行信息(验证回填口径) ==';
SELECT id, 单据编号, 行号, 物料编码, 数量, 采购订单行号 AS 采购订单行号, 采购单号 FROM sl_recv_detail WHERE id = 684;
GO
PRINT '== 四单明细里与「采购订单行号/采购单号」相关的列 ==';
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('sl_recv_detail','qc_insp_detail','qc_return_detail','bl_purchase_in','qc_tc_in_detail')
  AND (COLUMN_NAME LIKE N'%采购%' OR COLUMN_NAME LIKE N'%源单%' OR COLUMN_NAME IN (N'id', N'单据编号', N'行号'))
ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO
PRINT '== 可按「目标行.采购订单行号」回填的失效 link 覆盖情况 ==';
SELECT x.target_panel_code, x.n AS 失效总数,
       SUM(CASE WHEN x.行号 IS NOT NULL THEN 1 ELSE 0 END) AS 可用目标行号回填,
       SUM(CASE WHEN x.行号 IS NULL THEN 1 ELSE 0 END) AS 目标行号缺失
FROM (
  SELECT l.id, l.target_panel_code,
         (SELECT TOP 1 CAST(d.采购订单行号 AS nvarchar(50))
            FROM sl_recv_detail d
           WHERE l.target_panel_code = N'QC_RECV' AND d.单据编号 = l.target_form_no
             AND l.target_line_key = l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))) AS 行号,
         1 AS n
    FROM form_flow_link l
   WHERE l.source_panel_code = N'PU_ORDER'
     AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号 = l.source_form_no
                     AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key)
) x GROUP BY x.target_panel_code, x.n;
GO
PRINT '== SO_ORDER 失效 link ==';
SELECT COUNT(*) AS so_missing FROM form_flow_link l
WHERE l.source_panel_code = N'SO_ORDER'
  AND NOT EXISTS (SELECT 1 FROM bl_so_order o WHERE o.单据编号 = l.source_form_no
                  AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key);
GO
PRINT '== 材料码打印记录失效数 ==';
SELECT COUNT(*) AS label_missing FROM bl_pu_label lb
WHERE NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.id = lb.采购订单行id);
