SET NOCOUNT ON;
PRINT '== qc_proc_insp_detail 关键文本列的长度 ==';
SELECT c.name AS 列, t.name AS 类型,
       CASE WHEN t.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END AS 长度
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
  AND c.name IN (N'检验要求', N'检验方法', N'产线常规功能性结果', N'结果判断', N'实测数值', N'检验项目', N'表区')
ORDER BY c.column_id;
