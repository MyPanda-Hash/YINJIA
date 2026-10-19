SET NOCOUNT ON;
SELECT id, rid, 物料编码, LEN(物料编码) AS 码长, 批号, asp_cancel AS 作废, CONVERT(varchar(19),asp_time1,120) AS 写入
  FROM dbo.outh WHERE src = 6 AND 单据编号 = N'SCLL-20260902-00011' ORDER BY rid, id;
