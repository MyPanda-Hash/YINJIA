SET NOCOUNT ON;
PRINT '== SO 失效 link 样本 + 对应 plang 行 ==';
SELECT TOP 10 l.id, l.source_form_no, l.source_line_key, l.target_panel_code, l.target_form_no, l.target_line_key,
       p.id AS plang_id, p.pl_no, p.pl_xc, p.od_no, p.od_xc, p.dm
FROM form_flow_link l
LEFT JOIN plang p ON p.pl_no = l.target_form_no AND p.od_no = l.source_form_no
WHERE l.source_panel_code = N'SO_ORDER'
  AND NOT EXISTS (SELECT 1 FROM bl_so_order o WHERE o.单据编号 = l.source_form_no
                  AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key)
ORDER BY l.id DESC;
GO
PRINT '== bl_so_order 行号 是否有重复 ==';
SELECT COUNT(*) AS 重复单数 FROM (SELECT 单据编号 FROM bl_so_order GROUP BY 单据编号 HAVING COUNT(*) <> COUNT(DISTINCT ISNULL(CAST(行号 AS nvarchar(50)),N''))) t;
GO
PRINT '== SO 失效 link:按 plang(od_no+od_xc) 可唯一回填的数量 / 总数 ==';
SELECT
 (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code=N'SO_ORDER'
    AND NOT EXISTS (SELECT 1 FROM bl_so_order o WHERE o.单据编号=l.source_form_no
        AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)) AS 失效总数,
 (SELECT COUNT(*) FROM form_flow_link l
    WHERE l.source_panel_code=N'SO_ORDER'
      AND NOT EXISTS (SELECT 1 FROM bl_so_order o WHERE o.单据编号=l.source_form_no
          AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)
      AND EXISTS (SELECT 1 FROM plang p JOIN bl_so_order o2 ON o2.单据编号=l.source_form_no
                    AND LTRIM(RTRIM(CAST(o2.行号 AS nvarchar(50))))=LTRIM(RTRIM(CAST(p.od_xc AS nvarchar(50))))
                  WHERE p.pl_no=l.target_form_no AND p.od_no=l.source_form_no)) AS 可回填;
GO
PRINT '== QC_INSP/QC_RETURN 失效 link 数 ==';
SELECT target_panel_code, COUNT(*) AS n FROM form_flow_link l
WHERE l.source_panel_code = N'PU_ORDER'
  AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号 = l.source_form_no
                  AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key)
GROUP BY target_panel_code;
