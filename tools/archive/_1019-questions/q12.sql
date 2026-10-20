SELECT TOP 20 供应商编码, 供应商名称 FROM bs_supplier WHERE 供应商名称 LIKE N'%文茹%' OR 供应商编码 LIKE '%WR%'
GO
SELECT TOP 10 单据编号, 供应商编码, 供应商名称, 批次号, 单据日期 FROM bd_purchase_in ORDER BY id DESC
GO
SELECT TOP 10 单据编号, 供应商代码, 批次号, 单据日期 FROM sl_recv WHERE ISNULL(批次号,'')<>'' ORDER BY id DESC
GO
SELECT TOP 10 单据编号, 批次号, 供应商编码 FROM bd_pu_label ORDER BY id DESC
