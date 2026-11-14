SET NOCOUNT ON;
SELECT TOP 8 单据编号, CONVERT(nvarchar(10),单据日期,120) AS 日期, 检验单号, 供应商, 退货类型, 批次号, 单据状态 FROM dbo.qc_return WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
SELECT TOP 8 单据编号, CONVERT(nvarchar(10),单据日期,120) AS 日期, 检验单号, 供应商, 产品名称, 不合格品数量, 批次号, 最终处理结果, 单据状态 FROM dbo.qc_tc_in WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
SELECT TOP 8 单据编号, 来源单据, 来源单号, 批次号, 单据状态, 是否已转ERP, ERP单号 FROM dbo.bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(来源单号,N'')<>N'' ORDER BY id DESC;
SELECT 来源单据, COUNT(*) AS 单数 FROM dbo.bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 来源单据;
