SET NOCOUNT ON;
PRINT '== SO 失效 link:目标 plang 行按物料唯一匹配订单行的覆盖 ==';
SELECT
 (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code=N'SO_ORDER'
    AND NOT EXISTS (SELECT 1 FROM bl_so_order o WHERE o.单据编号=l.source_form_no
        AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)) AS 失效总数,
 (SELECT COUNT(*) FROM form_flow_link l
    JOIN plang p ON p.pl_no = l.target_form_no AND p.od_no = l.source_form_no
   WHERE l.source_panel_code=N'SO_ORDER'
     AND NOT EXISTS (SELECT 1 FROM bl_so_order o WHERE o.单据编号=l.source_form_no
        AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)
     AND (SELECT COUNT(*) FROM bl_so_order o2 WHERE o2.单据编号=l.source_form_no AND o2.存货编码 = p.dm) = 1) AS 可按物料唯一回填;
GO
PRINT '== SO 每单明细行数分布 ==';
SELECT 明细行数, COUNT(*) AS 单数 FROM (SELECT 单据编号, COUNT(*) AS 明细行数 FROM bl_so_order GROUP BY 单据编号) t
GROUP BY 明细行数 ORDER BY 明细行数;
GO
PRINT '== QC_INSP 明细是否有采购订单行号 ==';
SELECT CASE WHEN COL_LENGTH('qc_insp_detail', N'采购订单行号') IS NULL THEN N'无该列' ELSE N'有' END AS 结论;
GO
PRINT '== 失效 PU link 里 QC_RECV 目标行 采购订单行号 为空的条数 ==';
SELECT COUNT(*) AS 需按物料回填 FROM form_flow_link l
JOIN sl_recv_detail d ON d.单据编号 = l.target_form_no
     AND l.target_line_key = l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
WHERE l.source_panel_code = N'PU_ORDER' AND l.target_panel_code = N'QC_RECV'
  AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号 = l.source_form_no
                  AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key)
  AND ISNULL(LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50)))),N'') = N'';
GO
PRINT '== 这批准按物料回填的,物料在订单内是否唯一 ==';
SELECT COUNT(*) AS 物料唯一 FROM form_flow_link l
JOIN sl_recv_detail d ON d.单据编号 = l.target_form_no
     AND l.target_line_key = l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
WHERE l.source_panel_code = N'PU_ORDER' AND l.target_panel_code = N'QC_RECV'
  AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号 = l.source_form_no
                  AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key)
  AND ISNULL(LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50)))),N'') = N''
  AND (SELECT COUNT(*) FROM bl_pu_order o2 WHERE o2.单据编号 = l.source_form_no AND o2.物料编码 = d.物料编码) = 1;
