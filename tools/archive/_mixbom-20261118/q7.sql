SELECT COUNT(DISTINCT 单据编号) docs, COUNT(DISTINCT 产品编码) prods FROM bs_asm_bom;
SELECT TOP 5 产品编码, COUNT(*) n FROM bs_asm_bom GROUP BY 产品编码 ORDER BY n DESC;
SELECT COUNT(*) AS wlbom_archived FROM yj_doc_status WHERE panel_code='WLBOM' AND ISNULL(archived,'N')='Y';
SELECT TOP 5 doc_no, archived, shr FROM yj_doc_status WHERE panel_code='WLBOM' ORDER BY id DESC;
SELECT TOP 5 m_no, m_date, wzdm1, wzmc1, wzdm2, wzmc2, gg2, bzl FROM mate;
SELECT COUNT(*) archived_asm FROM yj_doc_status WHERE panel_code='ASM_BOM' AND ISNULL(archived,'N')='Y'
