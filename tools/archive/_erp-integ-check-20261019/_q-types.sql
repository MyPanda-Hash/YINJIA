SET NOCOUNT ON;
SELECT c.name AS 列, t.name AS 类型, c.max_length, c.is_nullable
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID(N'dbo.erp_integ_api') AND c.name IN (N'方向', N'分类', N'请求方式', N'启用')
 ORDER BY c.column_id;
SELECT TOP 5 N'[' + 方向 + N']' AS 方向原样, DATALENGTH(方向) AS 方向字节,
              N'[' + 分类 + N']' AS 分类原样, DATALENGTH(分类) AS 分类字节
  FROM erp_integ_api ORDER BY id;
