SET NOCOUNT ON;
SELECT 单据编号, 批号, asp_cancel AS 作废, COUNT(*) AS 行数, MIN(CONVERT(varchar(19),asp_time1,120)) AS 最早, MAX(CONVERT(varchar(19),asp_time1,120)) AS 最晚
  FROM dbo.outh WHERE src = 6 AND 单据编号 IN (N'SCLL-20260902-00011', N'SCLL-20261014-00009')
 GROUP BY 单据编号, 批号, asp_cancel ORDER BY 单据编号, 批号;
SELECT N'--- 今天写入的行(探针产物)---' AS x;
SELECT 单据编号, COUNT(*) AS 今日行数 FROM dbo.outh WHERE src = 6 AND asp_time1 >= '2026-10-19' GROUP BY 单据编号;
