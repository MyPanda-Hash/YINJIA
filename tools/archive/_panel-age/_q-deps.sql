SET NOCOUNT ON;
-- _q-deps.sql — 候选面板底层视图/表的数据库侧依赖(只读):谁引用了它们
DECLARE @objs TABLE (name sysname PRIMARY KEY);
INSERT INTO @objs(name) VALUES
 ('v_purchase_in_detail'),('v_finish_in_detail'),('v_other_in_detail'),('v_outsource_in_detail'),
 ('v_sale_out_detail'),('v_material_out_detail'),('v_other_out_detail'),('v_outsource_issue_detail'),
 ('v_purchase_in_stats'),('v_finish_in_stats'),('v_other_in_stats'),('v_outsource_in_stats'),
 ('v_sale_out_stats'),('v_material_out_stats'),('v_other_out_stats'),('v_outsource_issue_stats'),
 ('v_sales_order_detail'),('v_sales_order_stats'),('v_stock_balance'),('v_stock_summary'),('v_lot_trace'),
 ('qc_op'),('qc_op_detail'),('qc_record'),('qc_record_detail'),('qc_disposal'),('rod_return'),('rod_return_detail');

-- 1) 每个对象被哪些视图/存储过程/函数引用
SELECT o.name AS target,
       ISNULL(STRING_AGG(CAST(OBJECT_NAME(d.referencing_id) AS nvarchar(200)), N', '), N'(无人引用)') AS referenced_by
FROM @objs o
LEFT JOIN sys.sql_expression_dependencies d ON d.referenced_id = OBJECT_ID(o.name)
GROUP BY o.name
ORDER BY o.name;
GO
-- 2) 候选对象是否存在、类型、行数(粗算)
DECLARE @objs2 TABLE (name sysname PRIMARY KEY);
INSERT INTO @objs2(name) VALUES
 ('v_purchase_in_detail'),('v_finish_in_detail'),('v_other_in_detail'),('v_outsource_in_detail'),
 ('v_sale_out_detail'),('v_material_out_detail'),('v_other_out_detail'),('v_outsource_issue_detail'),
 ('v_purchase_in_stats'),('v_finish_in_stats'),('v_other_in_stats'),('v_outsource_in_stats'),
 ('v_sale_out_stats'),('v_material_out_stats'),('v_other_out_stats'),('v_outsource_issue_stats'),
 ('v_sales_order_detail'),('v_sales_order_stats'),('v_stock_balance'),('v_stock_summary'),('v_lot_trace'),
 ('qc_op'),('qc_op_detail'),('qc_record'),('qc_record_detail'),('qc_disposal'),('rod_return'),('rod_return_detail');
CREATE TABLE #ex (name sysname, typ nvarchar(60), is_ms_shipped bit);
INSERT INTO #ex SELECT o.name, o.type_desc, o.is_ms_shipped FROM sys.objects o JOIN @objs2 x ON x.name = o.name;
SELECT name, typ, is_ms_shipped FROM #ex ORDER BY name;
GO
-- 3) 这些对象上的外键(被别的表引用=不能随便删)
SELECT OBJECT_NAME(fk.parent_object_id) AS child_table, fk.name AS fk_name,
       OBJECT_NAME(fk.referenced_object_id) AS parent_table
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.referenced_object_id) IN ('qc_op','qc_record','qc_disposal','rod_return')
   OR OBJECT_NAME(fk.parent_object_id) IN ('qc_op','qc_record','qc_disposal','rod_return');
