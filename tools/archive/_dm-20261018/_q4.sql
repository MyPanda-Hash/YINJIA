SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bs_dict') ORDER BY c.column_id;
SELECT TOP 20 字典类别, 代码 FROM bs_dict WHERE 字典类别 IN ('JYRY','WLFZ','SCX') ORDER BY 字典类别, 代码;
