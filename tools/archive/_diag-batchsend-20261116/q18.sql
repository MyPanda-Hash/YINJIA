SET NOCOUNT ON;
PRINT '== PU 失效 link:按 inventory_code 在订单内唯一 可回填 / 总数 ==';
SELECT
 (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code=N'PU_ORDER'
    AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号=l.source_form_no
        AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)) AS 失效总数,
 (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code=N'PU_ORDER'
    AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号=l.source_form_no
        AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)
    AND (SELECT COUNT(*) FROM bl_pu_order o2 WHERE o2.单据编号=l.source_form_no
          AND o2.物料编码 = l.inventory_code) = 1) AS 物料唯一可回填,
 (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code=N'PU_ORDER'
    AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号=l.source_form_no
        AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)
    AND ISNULL(l.inventory_code,N'')=N'') AS 物料为空,
 (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code=N'PU_ORDER'
    AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号=l.source_form_no
        AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)
    AND ISNULL(l.inventory_code,N'')<>N''
    AND (SELECT COUNT(*) FROM bl_pu_order o2 WHERE o2.单据编号=l.source_form_no
          AND o2.物料编码 = l.inventory_code) = 0) AS 物料在单里找不到;
GO
PRINT '== SO 失效 link:按 inventory_code 在订单内唯一 可回填 / 总数(去重) ==';
SELECT
 (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code=N'SO_ORDER'
    AND NOT EXISTS (SELECT 1 FROM bl_so_order o WHERE o.单据编号=l.source_form_no
        AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)) AS 失效总数,
 (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code=N'SO_ORDER'
    AND NOT EXISTS (SELECT 1 FROM bl_so_order o WHERE o.单据编号=l.source_form_no
        AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)
    AND (SELECT COUNT(*) FROM bl_so_order o2 WHERE o2.单据编号=l.source_form_no
          AND o2.存货编码 = l.inventory_code) = 1) AS 物料唯一可回填,
 (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code=N'SO_ORDER'
    AND NOT EXISTS (SELECT 1 FROM bl_so_order o WHERE o.单据编号=l.source_form_no
        AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)
    AND ISNULL(l.inventory_code,N'')=N'') AS 物料为空;
GO
PRINT '== 其余面板作为来源的失效 link 总览 ==';
SELECT l.source_panel_code, COUNT(*) AS 失效数 FROM form_flow_link l
WHERE l.source_panel_code IN (N'PU_ORDER', N'SO_ORDER')
  AND l.source_panel_code = N'PU_ORDER'
  AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号=l.source_form_no
        AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)
GROUP BY l.source_panel_code;
GO
PRINT '== 失效 PU link 的 link_status 分布 ==';
SELECT link_status, COUNT(*) AS n FROM form_flow_link l
WHERE l.source_panel_code=N'PU_ORDER'
  AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号=l.source_form_no
        AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)
GROUP BY link_status;
