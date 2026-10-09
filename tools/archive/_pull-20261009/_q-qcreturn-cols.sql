SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
SELECT c.name AS 列名 FROM sys.columns c
 WHERE c.object_id = OBJECT_ID('dbo.qc_return_detail')
   AND c.name IN (N'数量', N'退货数量', N'送检数量', N'不良数量')
 ORDER BY c.name;
PRINT N'-- qc_return_detail 行数 / 送检数量为空的行数';
SELECT COUNT(*) AS 总行数, SUM(CASE WHEN 送检数量 IS NULL THEN 1 ELSE 0 END) AS 送检数量为空
  FROM qc_return_detail WHERE ISNULL(asp_cancel,'N') <> 'Y';
