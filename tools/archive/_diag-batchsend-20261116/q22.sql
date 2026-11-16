SET NOCOUNT ON;
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE (TABLE_NAME='form_flow_link' AND COLUMN_NAME IN ('source_line_key','inventory_code','target_line_key'))
   OR (TABLE_NAME='bl_pu_label' AND COLUMN_NAME IN ('采购订单行号','采购订单行id'))
   OR (TABLE_NAME='bd_pu_label' AND COLUMN_NAME='采购订单号');
GO
SELECT TOP 3 lb.id, lb.单据编号, N'[' + CAST(lb.采购订单行号 AS nvarchar(50)) + N']' AS 行号值,
       N'[' + CAST(h.采购订单号 AS nvarchar(80)) + N']' AS 打印单上的订单号
FROM bl_pu_label lb JOIN bd_pu_label h ON h.单据编号 = lb.单据编号 ORDER BY lb.id DESC;
GO
SELECT TOP 3 id, N'[' + CAST(采购订单行号 AS nvarchar(50)) + N']' AS 暂收行号 FROM sl_recv_detail ORDER BY id DESC;
GO
SELECT TOP 3 id, N'[' + CAST(源单行号 AS nvarchar(50)) + N']' AS 源单行号, N'[' + CAST(源单编号 AS nvarchar(80)) + N']' AS 源单编号 FROM bl_purchase_in ORDER BY id DESC;
