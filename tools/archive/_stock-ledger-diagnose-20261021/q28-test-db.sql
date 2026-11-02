SET NOCOUNT ON;
SELECT 库 = DB_NAME(), 结存行数 = COUNT(*), 负行数 = SUM(CASE WHEN yl<0 THEN 1 ELSE 0 END), 合计 = CAST(SUM(yl) AS decimal(18,4)) FROM kucun;
SELECT 期初类 = 单据类型, 行数 = COUNT(*), 数量 = SUM(数量) FROM inh WHERE src = 0 GROUP BY 单据类型;
