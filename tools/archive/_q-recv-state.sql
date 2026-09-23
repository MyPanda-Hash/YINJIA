SET NOCOUNT ON;
SELECT name FROM sys.objects WHERE name IN ('qc_recv','qc_recv_detail','sl_recv','sl_recv_detail') ORDER BY name;
GO
