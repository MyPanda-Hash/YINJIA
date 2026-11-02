SET NOCOUNT ON;
SELECT label,col_name,dict_sql FROM yj_field WHERE panel_code='QC_RETURN' AND label IN ('退货类型','经手人','仓库');
GO
SELECT TOP 5 员工名称 FROM EMP WHERE 员工名称=N'冯敏';
GO
