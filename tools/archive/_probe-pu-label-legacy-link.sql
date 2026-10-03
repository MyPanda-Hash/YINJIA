SET NOCOUNT ON;
GO
PRINT '=== 正式账套:该打印单 + 它的 link(旧口径生成,键是普通订单行键) ===';
SELECT l.id AS 行id, h.单据编号, h.采购订单号, h.批次号, l.打印数量,
       '订单行id=' + CAST(l.采购订单行id AS varchar(20)) AS 行
FROM bd_pu_label h JOIN bl_pu_label l ON l.单据编号 = h.单据编号
WHERE h.采购订单号 = N'YJ-20260916-03' AND ISNULL(h.asp_cancel,'N') <> 'Y';
GO
SELECT id, source_panel_code, source_form_no, source_line_key, target_panel_code, target_form_no,
       linked_quantity, batch_no, link_status
FROM form_flow_link
WHERE source_form_no = N'YJ-20260916-03' AND ISNULL(batch_no,N'') <> N''
ORDER BY id DESC;
GO
PRINT '=== 按新口径两种键分别数出来的量(说明错位在哪) ===';
DECLARE @po nvarchar(50) = N'YJ-20260916-03', @line int = 4725, @lbl bigint = (SELECT MIN(id) FROM bl_pu_label WHERE 采购订单行id = 4725);
SELECT
  (SELECT ISNULL(SUM(linked_quantity),0) FROM form_flow_link
    WHERE source_panel_code='PU_ORDER' AND source_line_key = @po + N'#' + CAST(@line AS nvarchar(20))
      AND link_status='ACTIVE') AS 原行键上的量_新口径算作原行已送,
  (SELECT ISNULL(SUM(linked_quantity),0) FROM form_flow_link
    WHERE source_panel_code='PU_ORDER'
      AND source_line_key = @po + N'#' + CAST(@line AS nvarchar(20)) + N'@' + CAST(@lbl AS nvarchar(20))
      AND link_status='ACTIVE') AS 隔离行键上的量_新口径算作已生单;
GO
