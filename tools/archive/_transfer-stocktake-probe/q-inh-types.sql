SET NOCOUNT ON;
SELECT src, ISNULL(单据类型,N'(NULL)') AS 单据类型, COUNT(*) n, MIN(单据编号) 样例, MIN(单据日期) d FROM inh GROUP BY src, 单据类型 ORDER BY src;
