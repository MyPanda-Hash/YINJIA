SET NOCOUNT ON;
SELECT TOP 1 id, asp_cancel, 数量 FROM sl_recv_detail;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('sl_recv_detail') AND c.name LIKE 'asp%';
