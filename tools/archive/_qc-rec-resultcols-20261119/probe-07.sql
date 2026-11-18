SET NOCOUNT ON;
PRINT N'--- 测试库:结果列数 <> 5 的单 ---';
SELECT 单据编号, 物料编码, 结果列数, asp_time2 FROM dbo.qc_insp_rec WHERE ISNULL(结果列数,5) <> 5;
PRINT N'--- 测试库:最近改过的明细行(按 asp_time2) ---';
SELECT TOP 10 单据编号, id, 检验项, 结果1, 结果5, 结果6, 结果7, asp_user2, asp_time2
  FROM dbo.qc_insp_rec_detail ORDER BY asp_time2 DESC;
PRINT N'--- 测试库:头部最近修改 ---';
SELECT TOP 5 单据编号, 物料编码, 结果列数, asp_user2, asp_time2 FROM dbo.qc_insp_rec ORDER BY asp_time2 DESC;
