SET NOCOUNT ON;
PRINT '== plang 关键列 ==';
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='plang' ORDER BY ORDINAL_POSITION;
GO
PRINT '== 暂收行 采购单号 填充率 ==';
SELECT COUNT(*) AS 总行, SUM(CASE WHEN ISNULL(LTRIM(RTRIM(采购单号)),N'')<>N'' THEN 1 ELSE 0 END) AS 有采购单号 FROM sl_recv_detail;
GO
PRINT '== 失效 QC_RECV link 中,目标行能唯一匹配订单行(按 采购单号+物料编码)的数量 ==';
SELECT COUNT(*) AS 可唯一匹配 FROM form_flow_link l
JOIN sl_recv_detail d ON d.单据编号 = l.target_form_no
     AND l.target_line_key = l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
WHERE l.source_panel_code = N'PU_ORDER' AND l.target_panel_code = N'QC_RECV'
  AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号 = l.source_form_no
                  AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key)
  AND (SELECT COUNT(*) FROM bl_pu_order o2 WHERE o2.单据编号 = l.source_form_no
        AND o2.物料编码 = d.物料编码) = 1;
GO
PRINT '== 失效 QC_RECV link 总数(对照) ==';
SELECT COUNT(*) AS 失效总数 FROM form_flow_link l
WHERE l.source_panel_code = N'PU_ORDER' AND l.target_panel_code = N'QC_RECV'
  AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号 = l.source_form_no
                  AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key);
GO
PRINT '== 材料码打印记录:失效且能按(采购订单号+行号)重指的数量 ==';
SELECT
  (SELECT COUNT(*) FROM bl_pu_label lb WHERE NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.id = lb.采购订单行id)) AS 失效数,
  (SELECT COUNT(*) FROM bl_pu_label lb
     JOIN bd_pu_label h ON h.单据编号 = lb.单据编号
     JOIN bl_pu_order o ON o.单据编号 = h.采购订单号
          AND LTRIM(RTRIM(CAST(o.行号 AS nvarchar(50)))) = LTRIM(RTRIM(CAST(lb.采购订单行号 AS nvarchar(50))))
    WHERE NOT EXISTS (SELECT 1 FROM bl_pu_order x WHERE x.id = lb.采购订单行id)) AS 可重指数;
