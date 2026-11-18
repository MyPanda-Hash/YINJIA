SELECT s.doc_no, s.archived, s.shr, h.产品编号, h.产品名称 FROM yj_doc_status s LEFT JOIN rd_asm_proc_head h ON h.单据编号=s.doc_no WHERE s.panel_code='RD_ASM_PROC' AND ISNULL(s.archived,'N')='Y';
SELECT 单据编号, 产品编码, 产品名称, 版本号, 默认BOM, 状态, 来源 FROM bs_asm_bom WHERE 产品编码 IN ('C-23-11','A-48-41','B-92-25');
SELECT COUNT(*) c FROM bs_asm_bom WHERE 产品编码='C-23-11'
