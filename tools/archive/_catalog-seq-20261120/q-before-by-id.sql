SET NOCOUNT ON;
SELECT 'ROWS=' + CAST(COUNT(*) AS varchar(10)) FROM qc_sample_reg;
SELECT 'BYID: id=' + CAST(id AS varchar(10)) + ' seq=' + ISNULL(CAST(序号 AS varchar(10)),'null') + ' ' + ISNULL(检测元素,N'') + ' | ' + ISNULL(测试方法,N'')
FROM qc_sample_reg ORDER BY id;
