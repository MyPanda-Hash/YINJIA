SET NOCOUNT ON;
SELECT t.name, CASE WHEN EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'单据状态2') THEN 1 ELSE 0 END AS has_st2
FROM sys.tables t WHERE t.name IN ('bd_purchase_in','bd_finish_in','bd_other_in','bd_outsource_in','bd_sale_out','bd_material_out','bd_other_out','bd_outsource_issue')
ORDER BY t.name;
