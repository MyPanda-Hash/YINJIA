SET NOCOUNT ON
SELECT 'UOM|换算率字段', CASE WHEN EXISTS(SELECT 1 FROM yj_field WHERE panel_code='UOM' AND col_name=N'换算率') THEN '库有' ELSE '缺字段(列在)' END
UNION ALL SELECT 'PU_ORDER|数量2字段', CASE WHEN EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'数量2') THEN '库有' ELSE '缺字段(列在)' END
UNION ALL SELECT 'rd_approval|备注字段', CASE WHEN EXISTS(SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND (col_name=N'备注' OR label=N'备注')) THEN '库有' ELSE '缺字段(列在)' END
UNION ALL SELECT 'STOCK_STATUS|预警数量字段', CASE WHEN EXISTS(SELECT 1 FROM yj_field WHERE panel_code='STOCK_STATUS' AND col_name=N'预警数量') THEN '库有' ELSE '缺字段(列在)' END
UNION ALL SELECT 'DEPT|电话字段', CASE WHEN EXISTS(SELECT 1 FROM yj_field WHERE panel_code='DEPT' AND col_name=N'电话') THEN '库有' ELSE '缺字段(列在)' END
UNION ALL SELECT 'WH|联系人字段', CASE WHEN EXISTS(SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'联系人') THEN '库有' ELSE '缺字段(列在)' END
UNION ALL SELECT 'PU_ORDER|计量单位2字段', CASE WHEN EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'计量单位2') THEN '库有' ELSE '缺字段(列在)' END
