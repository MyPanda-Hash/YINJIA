SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('rd_x_sinter_head','rd_x_sinter_detail') ORDER BY TABLE_NAME, ORDINAL_POSITION;
SELECT TOP 3 单据编号,产品编号,产品名称,版本号 FROM rd_mold_proc_head;
SELECT TOP 3 单据编号,产品编号,产品名称,版本号,表单管理人 FROM rd_x_sinter_head;
SELECT COUNT(*) mold_docs FROM rd_mold_proc_head;
SELECT COUNT(*) xsinter_docs FROM rd_x_sinter_head;
SELECT COUNT(*) mold_recipe_rows FROM rd_mold_proc_detail WHERE 表区=N'配方表';
SELECT COUNT(*) xsinter_recipe_rows FROM rd_x_sinter_detail WHERE 表区=N'配方表';
SELECT s.doc_no, s.archived, h.产品编号 FROM yj_doc_status s LEFT JOIN rd_mold_proc_head h ON h.单据编号=s.doc_no WHERE s.panel_code='RD_MOLD_PROC' AND ISNULL(s.archived,'N')='Y';
SELECT s.doc_no, s.archived, h.产品编号 FROM yj_doc_status s LEFT JOIN rd_x_sinter_head h ON h.单据编号=s.doc_no WHERE s.panel_code='RD_X_SINTER' AND ISNULL(s.archived,'N')='Y'
