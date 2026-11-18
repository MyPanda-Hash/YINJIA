SELECT 单据编号, 产品编号, 产品名称, 烧结类型, 来源单号, 版本号, COUNT(*) OVER (PARTITION BY 单据编号) rows FROM bs_mix_bom ORDER BY 单据编号, 行序;
SELECT s.panel_code, s.doc_no, s.archived FROM yj_doc_status s WHERE s.panel_code IN ('RD_MOLD_PROC','RD_X_SINTER') AND ISNULL(s.archived,'N')='Y' ORDER BY s.doc_no;
SELECT 单据编号, 产品编号, 产品名称 FROM rd_mold_proc_head WHERE 单据编号 IN ('MP-2026-11-0001','MP-2026-11-0002');
