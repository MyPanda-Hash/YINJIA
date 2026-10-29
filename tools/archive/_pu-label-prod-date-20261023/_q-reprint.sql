-- 验证 PuLabelService.reprint 的新 SELECT(含 prodDate)与 labelRows 的新列(含 生产日期)在现役库上可执行
SELECT TOP 1 [采购订单号] AS orderNo, [批次号] AS batchNo,
       [供应商编码] AS supplierCode, CONVERT(varchar(10),[生产日期],120) AS prodDate
FROM bd_pu_label WHERE [单据编号] = N'MQ-2026-10-0019' AND ISNULL(asp_cancel,'N') <> 'Y';
