SELECT panel_code, ISNULL(archived,'N') AS arch, COUNT(*) AS n
FROM yj_doc_status
WHERE panel_code IN (N'RD_MOLD_PROC',N'RD_X_SINTER',N'RD_ASM_PROC')
GROUP BY panel_code, ISNULL(archived,'N');
SELECT TOP 5 单据编号, 产品编号, 产品名称 FROM rd_mold_proc_head;
SELECT COUNT(*) AS total_doc_status FROM yj_doc_status;