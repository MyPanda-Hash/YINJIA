SET NOCOUNT ON;
SELECT 单据编号, 行数 = COUNT(*), 数量 = SUM(数量),
       物料样例 = MIN(物料编码) + ' … ' + MAX(物料编码),
       仓库 = MIN(仓库编码) + ' / ' + MAX(仓库编码),
       写入者 = MIN(asp_user1), 写入时间 = MIN(asp_time1)
FROM inh WHERE 单据类型 = N'期初结存' GROUP BY 单据编号;

SELECT TOP 8 物料编码, 物料名称, 仓库编码, 批号, 数量 FROM inh WHERE 单据类型 = N'期初结存' ORDER BY 数量 DESC;
