SET NOCOUNT ON;
GO
PRINT '=== 1. 供应商档案面板/表 ===';
SELECT panel_code, panel_name, head_table, line_table FROM yj_panel WHERE panel_code LIKE '%GFDA%' OR panel_name LIKE N'%供应商%';
GO
PRINT '=== 2. 采购链四单 批次号/批次键 字段元数据 ===';
SELECT panel_code, place, seq, label, col_name, editable, required, visible, ref_panel
FROM yj_field
WHERE label IN (N'批次号', N'批次键')
  AND panel_code IN (N'PURCHASE_IN', N'QC_RECV', N'QC_INSP', N'QC_RETURN', N'QC_TC_IN')
ORDER BY panel_code, place, seq;
GO
PRINT '=== 3. 采购入库单头/行 现有批次号样例 ===';
SELECT TOP 20 单据编号, ISNULL(批次号,N'<NULL>') AS 批次号, ISNULL(供应商编码,N'<NULL>') AS 供应商编码,
       ISNULL(供应商,N'') AS 供应商, CONVERT(varchar(10),单据日期,120) AS 单据日期, 批次键
FROM bd_purchase_in ORDER BY id DESC;
GO
PRINT '=== 4. 送料暂收单/检验单 批次号现状 ===';
SELECT TOP 10 单据编号, ISNULL(批次号,N'<NULL>') AS 批次号, ISNULL(供应商代码,N'') AS 供应商代码, 批次键 FROM sl_recv ORDER BY id DESC;
GO
SELECT TOP 10 单据编号, ISNULL(批次号,N'<NULL>') AS 批次号, ISNULL(供应商代码,N'') AS 供应商代码, 批次键 FROM qc_insp ORDER BY id DESC;
GO
PRINT '=== 5. 批次台账 ===';
SELECT TOP 20 id, source_panel_code, source_form_no, batch_seq, ISNULL(batch_no,N'<NULL>') AS batch_no, status, target_panel_code, target_form_no FROM yj_doc_batch ORDER BY id DESC;
GO
