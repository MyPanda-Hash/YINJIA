SELECT COUNT(*) AS n FROM rd_prod_info_head;
SELECT TOP 10 [产品编号],[产品名称] FROM rd_prod_info_head ORDER BY id DESC;
SELECT TOP 10 [产品编号],[产品名称] FROM rd_prod_info_head WHERE [产品编号] LIKE '%46%' OR [产品名称] LIKE '%46%';
