SET NOCOUNT ON;
SELECT c.name AS 列名, LEN(c.name) AS 字符数, DATALENGTH(c.name) AS 字节数, CONVERT(varchar(120), CONVERT(varbinary(40), c.name), 2) AS hex
  FROM sys.columns c WHERE c.object_id = OBJECT_ID('rd_prod_info_head') AND c.name LIKE N'%名称%';
GO
SELECT N'我写的字面量' AS 项, LEN(N'产品名称') AS 字符数, DATALENGTH(N'产品名称') AS 字节数, CONVERT(varchar(120), CONVERT(varbinary(40), N'产品名称'), 2) AS hex;
GO
SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('rd_prod_info_head','rd_dev_task');
GO
