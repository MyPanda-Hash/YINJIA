SELECT 'asm_proc' t, COUNT(*) n FROM rd_asm_proc_head UNION ALL SELECT 'asm_bom', COUNT(*) FROM bs_asm_bom UNION ALL SELECT 'mold', COUNT(*) FROM rd_mold_proc_head UNION ALL SELECT 'xsinter', COUNT(*) FROM rd_x_sinter_head UNION ALL SELECT 'mold_recipe', COUNT(*) FROM rd_mold_proc_detail WHERE 表区=N'配方表' UNION ALL SELECT 'xsinter_recipe', COUNT(*) FROM rd_x_sinter_detail WHERE 表区=N'配方表';
SELECT s.panel_code, s.doc_no, s.archived, s.shr FROM yj_doc_status s WHERE s.panel_code IN ('RD_ASM_PROC','RD_MOLD_PROC','RD_X_SINTER') AND ISNULL(s.archived,'N')='Y';
SELECT h.单据编号, h.产品编号, (SELECT COUNT(*) FROM rd_asm_proc_detail d WHERE d.单据编号=h.单据编号 AND d.表区=N'物料清单') bom_rows FROM rd_asm_proc_head h ORDER BY h.单据编号 DESC;
SELECT h.单据编号, h.产品编号, (SELECT COUNT(*) FROM rd_mold_proc_detail d WHERE d.单据编号=h.单据编号 AND d.表区=N'配方表') recipe_rows FROM rd_mold_proc_head h ORDER BY h.单据编号 DESC;
SELECT TOP 5 单据编号,产品编码,产品名称,版本号,默认BOM FROM bs_asm_bom
