SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('qc_tc_in') AND c.name LIKE N'%数量%';
SELECT TOP 3 总数量 FROM qc_tc_in WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
