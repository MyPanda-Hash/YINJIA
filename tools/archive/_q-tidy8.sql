SET NOCOUNT ON;
SELECT v.col AS 待检列, CASE WHEN EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID('rd_prod_info_head') AND c.name = v.col) THEN N'有' ELSE N'**缺**' END AS 结果
FROM (VALUES (N'单据编号'),(N'单据日期'),(N'产品编号'),(N'产品名称'),(N'产品类别'),(N'客户项目名称'),(N'产品负责人'),
             (N'产品形态'),(N'产品功能类别'),(N'产品管控等级'),(N'审核人一级'),(N'审核人二级'),(N'备注'),(N'asp_user1'),(N'asp_time1')) AS v(col);
GO
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('rd_prod_info_head') AND (name LIKE N'%产品%' OR name LIKE N'%负责%' OR name LIKE N'%责任%');
GO
