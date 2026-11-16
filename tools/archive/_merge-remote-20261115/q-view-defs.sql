/* 对比测试库与正式库这些视图的定义是否一致(不一致=测试库陈旧;一致=基表结构差异) */
SELECT o.name AS view_name,
       HASHBYTES('SHA1', m.definition) AS test_hash,
       (SELECT HASHBYTES('SHA1', m2.definition)
          FROM HSDZ_MES.sys.sql_modules m2
         WHERE m2.object_id = OBJECT_ID('HSDZ_MES.dbo.' + o.name)) AS prod_hash
FROM sys.views o
JOIN sys.sql_modules m ON m.object_id = o.object_id
WHERE o.name IN (N'v_dispatch_stats', N'v_material_out_detail', N'v_material_out_stats',
                 N'v_purchase_in_detail', N'v_purchase_in_stats', N'v_sales_order_stats',
                 N'v_sale_out_detail', N'v_sale_out_stats')
ORDER BY o.name;
