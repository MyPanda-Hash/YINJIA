SELECT TOP 20 单据编号, 单据日期, 供应商代码, 批次号, asp_time1 FROM sl_recv ORDER BY id DESC
GO
SELECT TOP 10 供应商编码, 供应商名称 FROM bd_supplier ORDER BY 供应商编码
GO
SELECT code, display_name, group_name, module, category, seq FROM yj_panel WHERE code IN ('QC_INSP','QC_RECV','QC_RETURN','QC_TC_IN','QC_CATALOG','QC_INSP_REC','QC_JJF') ORDER BY code
