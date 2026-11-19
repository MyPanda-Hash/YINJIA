SELECT 'bs_mix_bom' AS obj, (SELECT COUNT(*) FROM bs_mix_bom) AS rows_, (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_mix_bom') AS cols_;
SELECT COUNT(*) AS mix_fields FROM yj_field WHERE panel_code='MIX_BOM';
SELECT s.panel_code, COUNT(*) AS archived_docs FROM yj_doc_status s WHERE s.panel_code IN (N'RD_MOLD_PROC',N'RD_X_SINTER',N'RD_ASM_PROC') AND ISNULL(s.archived,'N')='Y' GROUP BY s.panel_code;
SELECT COUNT(*) AS mold_proc_head FROM rd_mold_proc_head;
SELECT COUNT(*) AS xsinter_head FROM rd_x_sinter_head;