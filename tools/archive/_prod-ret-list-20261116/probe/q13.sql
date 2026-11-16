SET NOCOUNT ON;
SELECT TOP 20 'R|' + 单据编号 + '|' + CONVERT(VARCHAR(10), 单据日期, 120) + '|' + ISNULL(工单号,N'') + '|' + ISNULL(物料编码,N'') + '|' + ISNULL(物料名称,N'') + '|' + ISNULL(仓库名称,N'') + '|' + ISNULL(批号,N'') + '|' + CAST(ISNULL(数量,0) AS VARCHAR(20)) + '|' + CAST(ISNULL(成本单价,0) AS VARCHAR(20)) + '|' + CAST(ISNULL(成本金额,0) AS VARCHAR(20)) + '|' + ISNULL(asp_user1,N'')
FROM v_prod_ret_list ORDER BY 单据日期 DESC, id DESC;
