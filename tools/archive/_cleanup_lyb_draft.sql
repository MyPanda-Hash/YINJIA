-- 清理验证用测试草稿(QC_LYB LYB-2026-09-0001,自动化验证造数;用户自建 QC_BHG 草稿保留)
DELETE FROM qc_lyb WHERE [单据编号] = N'LYB-2026-09-0001';
DELETE FROM qc_lyb_detail WHERE [单据编号] = N'LYB-2026-09-0001';
DELETE FROM yj_doc_status WHERE panel_code = 'QC_LYB' AND doc_no = 'LYB-2026-09-0001';
-- 验证:LYB 应清零,BHG 草稿仍在
SELECT 'QC_LYB' AS panel, COUNT(*) AS cnt FROM qc_lyb
UNION ALL SELECT 'QC_BHG', COUNT(*) FROM qc_bhg
UNION ALL SELECT 'doc_status_LYB', COUNT(*) FROM yj_doc_status WHERE panel_code = 'QC_LYB'
UNION ALL SELECT 'doc_status_BHG', COUNT(*) FROM yj_doc_status WHERE panel_code = 'QC_BHG';
