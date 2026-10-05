SET NOCOUNT ON;
SELECT N'1-DETAIL-COLS' AS seg, t.name AS tbl,
       CAST(COL_LENGTH(t.name, N'批次号') AS varchar(10)) AS len_批次号,
       CAST(COL_LENGTH(t.name, N'批次键') AS varchar(10)) AS len_批次键
FROM sys.tables t
WHERE t.name IN ('qc_jjf_detail','qc_return_detail','qc_tc_in_detail','qc_insp_detail','sl_recv_detail','bd_purchase_in_detail')
ORDER BY t.name;
SELECT N'2-YJFIELD' AS seg, panel_code, col_name, place, CAST(editable AS varchar(5)) AS editable
FROM yj_field WHERE panel_code IN ('QC_JJF','QC_RETURN') AND col_name IN (N'批次号',N'物料批次',N'批次键')
ORDER BY panel_code, seq;
