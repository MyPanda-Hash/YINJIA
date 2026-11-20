SELECT COUNT(*) AS plans FROM rd_insp_plan_head;
SELECT TOP 5 [单据编号],[产品编号],[标题] FROM rd_insp_plan_head ORDER BY id DESC;
SELECT COUNT(*) AS detail_cols FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_insp_plan_detail';
