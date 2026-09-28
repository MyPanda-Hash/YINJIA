SET NOCOUNT ON
SELECT '1.PU_ORDER字段数: '+CAST(COUNT(*) AS varchar) FROM yj_field WHERE panel_code='PU_ORDER'
SELECT '2.PU_ORDER有供应商编码: '+CASE WHEN EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商编码') THEN N'有' ELSE N'❌缺' END
SELECT '3.PURCHASE_IN隐藏位(应=1): 采购订单号='+ISNULL((SELECT CAST(hidden AS varchar) FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'采购订单号'),'无')+' ERP单号='+ISNULL((SELECT CAST(hidden AS varchar) FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'ERP单号'),'无')
SELECT '4.INV来料检验隐藏位(应=1): '+ISNULL((SELECT CAST(hidden AS varchar) FROM yj_field WHERE panel_code='INV' AND col_name=N'来料检验'),'无')
SELECT '5.bl_purchase_in.仓库列: '+CASE WHEN COL_LENGTH('bl_purchase_in',N'仓库') IS NULL THEN N'❌缺' ELSE N'有' END
SELECT '6.PURCHASE_IN.仓库字段: place='+ISNULL((SELECT place FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库'),'❌缺')
SELECT '7.QC_INSP特采字段: '+CASE WHEN EXISTS(SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'特采') THEN N'有' ELSE N'❌缺' END
SELECT '8.bl_purchase_in.仓库有值行: '+CAST((SELECT COUNT(*) FROM bl_purchase_in WHERE ISNULL(仓库,N'')<>N'') AS varchar)
