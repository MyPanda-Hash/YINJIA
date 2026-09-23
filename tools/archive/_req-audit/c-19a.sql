SET NOCOUNT ON;
SELECT COUNT(*) AS sl_recv_detail行数 FROM sl_recv_detail;
GO
SELECT COUNT(*) AS 批号空 FROM sl_recv_detail WHERE 批号 IS NULL OR 批号 = N'';
GO
