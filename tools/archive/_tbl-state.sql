SET NOCOUNT ON;
SELECT name FROM sys.tables WHERE name LIKE 'gx%' OR name LIKE '%line_capacity%' OR name IN ('bs_prod_line','bs_line_open','bd_prod_abn','bd_op_time') ORDER BY name;
SELECT OBJECT_NAME(object_id) AS obj, name AS col FROM sys.columns WHERE object_id = OBJECT_ID('bs_dict') AND name IN (N'字典类别') ;
SELECT TOP 5 字典类别, 代码, 名称 FROM bs_dict WHERE 字典类别 LIKE N'%10%' ORDER BY 字典类别;
