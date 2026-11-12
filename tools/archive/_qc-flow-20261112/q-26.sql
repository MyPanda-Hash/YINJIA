SET NOCOUNT ON;
SELECT COUNT(*) AS 退货单 FROM dbo.qc_return WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT COUNT(*) AS 退货单行 FROM dbo.qc_return_detail WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT COUNT(*) AS 特采单 FROM dbo.qc_tc_in WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT COUNT(*) AS 入库已转ERP FROM dbo.bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y' AND 是否已转ERP = N'是';
SELECT COUNT(*) AS 入库已审核 FROM dbo.bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据状态 = N'已审核';
