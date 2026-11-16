SELECT o.name AS view_name,
       CASE WHEN COL_LENGTH('dbo.' + o.name, 'asp_cancel') IS NULL THEN 'NO' ELSE 'YES' END AS has_asp_cancel,
       CASE WHEN COL_LENGTH('dbo.' + o.name, 'id') IS NULL THEN 'NO' ELSE 'YES' END AS has_id
FROM sys.views o
WHERE o.name IN (N'v_dispatch_stats', N'v_material_out_detail', N'v_material_out_stats',
                 N'v_purchase_in_detail', N'v_purchase_in_stats', N'v_sales_order_stats',
                 N'v_sale_out_detail', N'v_sale_out_stats')
ORDER BY o.name;
