SET NOCOUNT ON;
PRINT '== 旧行 id 是否还在(11035..11043 / 11044) ==';
SELECT id, 单据编号, 行号 FROM bl_pu_order WHERE id BETWEEN 11035 AND 11044;
GO
PRINT '== 本日 links 引用的行 id 现在还在不在 ==';
SELECT l.source_form_no, l.source_line_key,
       CASE WHEN EXISTS (SELECT 1 FROM bl_pu_order o WHERE N'' + o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = l.source_line_key)
            THEN N'仍然有效' ELSE N'已失效(行id被同步重建)' END AS 状态
FROM form_flow_link l WHERE l.batch_no = N'20261116' AND l.source_panel_code = N'PU_ORDER' ORDER BY l.id;
GO
PRINT '== 材料码打印记录引用的行 id 是否还在 ==';
SELECT lb.id, lb.单据编号, lb.采购订单行id,
       CASE WHEN EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.id = lb.采购订单行id) THEN N'仍有效' ELSE N'已失效' END AS 状态
FROM bl_pu_label lb ORDER BY lb.id DESC;
GO
PRINT '== 该单当前各行的已送(按 link 精确匹配) ==';
SELECT o.id, o.行号, o.物料编码, o.数量,
       ISNULL((SELECT SUM(l.linked_quantity) FROM form_flow_link l
               WHERE l.source_panel_code=N'PU_ORDER' AND l.source_form_no=o.单据编号
                 AND l.source_line_key = o.单据编号 + N'#' + CAST(o.id AS nvarchar(20))
                 AND l.link_status='ACTIVE'),0) AS 当前已送
FROM bl_pu_order o WHERE o.单据编号 = N'YJ-20261111-06' ORDER BY o.id;
