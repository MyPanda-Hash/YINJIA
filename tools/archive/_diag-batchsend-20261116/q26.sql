SET NOCOUNT ON;
PRINT '== 回填后:失效占用/材料码 ==';
SELECT
 (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code=N'PU_ORDER'
    AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号=l.source_form_no
       AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)) AS PU失效,
 (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code=N'SO_ORDER'
    AND NOT EXISTS (SELECT 1 FROM bl_so_order o WHERE o.单据编号=l.source_form_no
       AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key)) AS SO失效,
 (SELECT COUNT(*) FROM bl_pu_label lb WHERE NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.id=lb.采购订单行id)) AS 材料码失效;
GO
PRINT '== 报障那单:各行已送(按 link 精确匹配)==';
SELECT o.id, o.行号, o.物料编码, o.数量,
  ISNULL((SELECT SUM(l.linked_quantity) FROM form_flow_link l
          WHERE l.source_panel_code=N'PU_ORDER' AND l.source_form_no=o.单据编号
            AND l.source_line_key=o.单据编号+N'#'+CAST(o.id AS nvarchar(20))
            AND l.link_status='ACTIVE'),0) AS 已送
FROM bl_pu_order o WHERE o.单据编号=N'YJ-20261111-06' ORDER BY o.id;
GO
PRINT '== 5146 那笔现在指向哪 ==';
SELECT l.id, l.source_line_key, l.linked_quantity, o.行号, o.物料编码 FROM form_flow_link l
LEFT JOIN bl_pu_order o ON l.source_line_key = l.source_form_no + N'#' + CAST(o.id AS nvarchar(20))
WHERE l.id = 5146;
GO
PRINT '== 剩余失效明细(供人工看)==';
SELECT TOP 20 l.id, l.source_panel_code, l.source_form_no, l.source_line_key, l.inventory_code, l.linked_quantity, l.link_status
FROM form_flow_link l
WHERE (l.source_panel_code=N'PU_ORDER' AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号=l.source_form_no AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key))
   OR (l.source_panel_code=N'SO_ORDER' AND NOT EXISTS (SELECT 1 FROM bl_so_order o WHERE o.单据编号=l.source_form_no AND o.单据编号+N'#'+CAST(o.id AS nvarchar(20))=l.source_line_key))
ORDER BY l.id;
