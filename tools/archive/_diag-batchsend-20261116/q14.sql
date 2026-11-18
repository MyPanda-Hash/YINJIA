SET NOCOUNT ON;
PRINT '== QC_RECV 失效 link:可回填 / 不可回填 ==';
SELECT
  (SELECT COUNT(*) FROM form_flow_link l
    WHERE l.source_panel_code = N'PU_ORDER' AND l.target_panel_code = N'QC_RECV'
      AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号 = l.source_form_no
                      AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key)) AS 失效数,
  (SELECT COUNT(*) FROM form_flow_link l
     JOIN sl_recv_detail d ON d.单据编号 = l.target_form_no
          AND l.target_line_key = l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
     JOIN bl_pu_order o ON o.单据编号 = l.source_form_no
          AND LTRIM(RTRIM(CAST(o.行号 AS nvarchar(50)))) = LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50))))
    WHERE l.source_panel_code = N'PU_ORDER' AND l.target_panel_code = N'QC_RECV'
      AND NOT EXISTS (SELECT 1 FROM bl_pu_order x WHERE x.单据编号 = l.source_form_no
                      AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key)) AS 可回填;
GO
PRINT '== 暂收明细中 采购订单行号 为空的行占比 ==';
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN ISNULL(LTRIM(RTRIM(CAST(采购订单行号 AS nvarchar(50)))),N'') = N'' THEN 1 ELSE 0 END) AS 空行号
FROM sl_recv_detail;
GO
PRINT '== 采购入库行 源单编号/源单行号 样本 ==';
SELECT TOP 5 id, 单据编号, 行号, 存货编码, 源单编号, 源单行号 FROM bl_purchase_in WHERE ISNULL(源单编号,N'') <> N'' ORDER BY id DESC;
GO
PRINT '== 采购入库失效 link 的目标行 ==';
SELECT l.id, l.source_form_no, l.target_form_no, l.target_line_key, b.源单编号, b.源单行号
FROM form_flow_link l
JOIN bl_purchase_in b ON b.单据编号 = l.target_form_no
     AND l.target_line_key = l.target_form_no + N'#' + CAST(b.id AS nvarchar(20))
WHERE l.source_panel_code = N'PU_ORDER' AND l.target_panel_code = N'PURCHASE_IN'
  AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号 = l.source_form_no
                  AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key);
GO
PRINT '== 销售订单失效 link 的目标面板 ==';
SELECT target_panel_code, COUNT(*) AS n FROM form_flow_link l
WHERE l.source_panel_code = N'SO_ORDER'
  AND NOT EXISTS (SELECT 1 FROM bl_so_order o WHERE o.单据编号 = l.source_form_no
                  AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key)
GROUP BY target_panel_code;
