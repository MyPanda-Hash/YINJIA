SET NOCOUNT ON;
-- d-07 form_flow_link 列结构
SELECT c.name AS 列名, ty.name AS 类型 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('form_flow_link') ORDER BY c.column_id;
GO
SELECT TOP 5 * FROM form_flow_link ORDER BY id DESC;
GO
-- d-07b 面板编码有效性(报表模板 panelCode 与 SL_RECV→QC_RECV 改名后的一致性)
SELECT N'SL_RECV 面板行数' AS 项, COUNT(*) AS 值 FROM yj_panel WHERE panel_code='SL_RECV'
UNION ALL SELECT N'QC_RECV 面板行数', COUNT(*) FROM yj_panel WHERE panel_code='QC_RECV'
UNION ALL SELECT N'yj_report_template 中 panel_code 不存在于 yj_panel 的行数',
   (SELECT COUNT(*) FROM yj_report_template t WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code=t.panel_code))
UNION ALL SELECT N'yj_doc_batch 中 target=SL_RECV 的行数', COUNT(*) FROM yj_doc_batch WHERE target_panel_code='SL_RECV';
GO
-- d-07c 面板 config 旗标
SELECT panel_code, panel_name,
       CASE WHEN config LIKE N'%batchFlow%' THEN 1 ELSE 0 END AS 有batchFlow,
       CASE WHEN config LIKE N'%reportQueryDialog%' THEN 1 ELSE 0 END AS 有reportQueryDialog,
       CASE WHEN config LIKE N'%docArchive%' THEN 1 ELSE 0 END AS 有docArchive
FROM yj_panel
WHERE config LIKE N'%batchFlow%' OR config LIKE N'%reportQueryDialog%'
ORDER BY panel_code;
GO
-- d-07d 2026-09-18 手工改库(只提交探针 SQL)的字段现状
SELECT panel_code, col_name, label, data_type, editable, hidden, visible, dict_sql
FROM yj_field WHERE (panel_code='PURCHASE_IN' AND col_name IN (N'是否来料检验',N'采购订单号',N'采购订单行号'))
   OR (panel_code='INV' AND col_name IN (N'商品类型',N'来料检验',N'检验方式',N'是否来料检验'))
ORDER BY panel_code, seq;
GO
