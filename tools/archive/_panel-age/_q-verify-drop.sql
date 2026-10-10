SET NOCOUNT ON;
-- _q-verify-drop.sql — 下架后的复核(两账套都跑;期望值见括号)
SELECT DB_NAME() AS 库,
       (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_IN_DETAIL','OTHER_IN_STATS','OTHER_OUT','OTHER_OUT_DETAIL','OTHER_OUT_STATS','OUTSOURCE_IN','OUTSOURCE_IN_DETAIL','OUTSOURCE_IN_STATS','OUTSOURCE_ISSUE','OUTSOURCE_ISSUE_DETAIL','OUTSOURCE_ISSUE_STATS')) AS 面板残留,
       (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_IN_DETAIL','OTHER_IN_STATS','OTHER_OUT','OTHER_OUT_DETAIL','OTHER_OUT_STATS','OUTSOURCE_IN','OUTSOURCE_IN_DETAIL','OUTSOURCE_IN_STATS','OUTSOURCE_ISSUE','OUTSOURCE_ISSUE_DETAIL','OUTSOURCE_ISSUE_STATS')) AS 字段残留,
       (SELECT COUNT(*) FROM dbo.yj_role_panel WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE')) AS 授权残留,
       (SELECT COUNT(*) FROM sys.objects WHERE name IN ('v_other_in_detail','v_other_in_stats','v_other_out_detail','v_other_out_stats','v_outsource_in_detail','v_outsource_in_stats','v_outsource_issue_detail','v_outsource_issue_stats')) AS 视图残留,
       (SELECT COUNT(*) FROM sys.objects WHERE name IN ('bd_pu_req','bl_pu_req','bd_other_in','bl_other_in','bd_other_out','bl_other_out','bd_outsource_in','bl_outsource_in','bd_outsource_issue','bl_outsource_issue')) AS 表残留;
GO
SELECT DB_NAME() AS 库,
       (SELECT COUNT(*) FROM dbo.yj_panel) AS 面板总数,
       (SELECT COUNT(*) FROM dbo.yj_field) AS 字段总数,
       (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','MATERIAL_OUT','FINISH_IN','OUTSOURCE_ORDER','PU_ORDER')) AS 保留单据面板,
       (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code IN ('STOCK_BALANCE','STOCK_SUMMARY','STOCK_LEDGER')) AS 库存三报表,
       (SELECT COUNT(*) FROM dbo.yj_field f WHERE f.ref_panel IS NOT NULL AND f.ref_panel <> '' AND NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_code = f.ref_panel)) AS 悬空参照,
       (SELECT COUNT(*) FROM dbo.yj_panel p WHERE (p.line_table IS NOT NULL AND p.line_table <> '' AND OBJECT_ID(p.line_table) IS NULL) OR (p.head_table IS NOT NULL AND p.head_table <> '' AND OBJECT_ID(p.head_table) IS NULL)) AS 指向缺失表的面板,
       (SELECT COUNT(*) FROM dbo.form_flow_link WHERE source_panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE') OR target_panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE')) AS 链路残留;
GO
SELECT DB_NAME() AS 库, '译名残留(面板名)' AS 项, COUNT(*) AS n FROM dbo.yj_translation t
 WHERE t.scope='panel' AND t.ref_key IN (N'请购单',N'其他入库单',N'其他入库单明细表',N'其他入库单统计表',N'其他出库单',N'其他出库单明细表',N'其他出库单统计表',N'委外入库单',N'委外入库单明细表',N'委外入库单统计表',N'委外发料单',N'委外发料单明细表',N'委外发料单统计表');
GO
SELECT DB_NAME() AS 库, '仍被引用的孤儿标签(期望 0)' AS 项, COUNT(*) AS n FROM dbo.yj_translation t
 WHERE t.scope='field' AND NOT EXISTS (SELECT 1 FROM dbo.yj_field f WHERE f.label = t.ref_key) AND t.ref_key IN (N'报价',N'到货地址',N'发料仓库',N'发料单数',N'含税总金额',N'合理损耗数量',N'建议供应商',N'来料客户',N'请购人',N'入库单数',N'是否带票',N'收货人',N'外部单据号',N'委外加工单号',N'需求日期',N'自动生入库单',N'累计调拨入库量');
GO
SELECT DB_NAME() AS 库, panel_code, panel_name, module_group FROM dbo.yj_panel
 WHERE module_group IN (N'库存核算', N'委外加工', N'采购管理') ORDER BY module_group, panel_code;
