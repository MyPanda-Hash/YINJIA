-- migrate-po-pi-attach.sql — 采购订单 PU_ORDER / 采购入库单 PURCHASE_IN 补 6 附件列位(2026-09-16)
-- 用户口径:两单据与 送料暂收单/来料检验单/暂收退料单 同款附件能力——
-- 头表 6 个 nvarchar(500) 名称列位(附件1..附件6),页面只渲染 1 个附件格聚合展示,
-- 上传按序占第一个空余列位,文件实体存 yj_attachment(锚点 = panelCode + 单据编号 + 列位名)。
-- 前端零改动:附件区由 yj_field.data_type=N'附件' 驱动(PanelxList/PanelxForm 从表头网格剔除、
-- 单独渲染 .attach-strip),单据号键已用 curDocNo(单据编号||编号)兜底。
-- 译名 附件1..6(en/ja)为全局共享词条,已存在,不重复插。
-- 幂等: 可重复执行(逐列判存 + 清旧插新)。
SET NOCOUNT ON;

-- ══════════ 1. 头表补列(逐列独立判断,混合状态可收敛) ══════════
IF OBJECT_ID('bd_pu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_pu_order', N'附件1') IS NULL ALTER TABLE bd_pu_order ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('bd_pu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_pu_order', N'附件2') IS NULL ALTER TABLE bd_pu_order ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('bd_pu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_pu_order', N'附件3') IS NULL ALTER TABLE bd_pu_order ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('bd_pu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_pu_order', N'附件4') IS NULL ALTER TABLE bd_pu_order ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('bd_pu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_pu_order', N'附件5') IS NULL ALTER TABLE bd_pu_order ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('bd_pu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_pu_order', N'附件6') IS NULL ALTER TABLE bd_pu_order ADD [附件6] nvarchar(500) NULL;
IF OBJECT_ID('bd_purchase_in') IS NOT NULL AND COL_LENGTH('dbo.bd_purchase_in', N'附件1') IS NULL ALTER TABLE bd_purchase_in ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('bd_purchase_in') IS NOT NULL AND COL_LENGTH('dbo.bd_purchase_in', N'附件2') IS NULL ALTER TABLE bd_purchase_in ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('bd_purchase_in') IS NOT NULL AND COL_LENGTH('dbo.bd_purchase_in', N'附件3') IS NULL ALTER TABLE bd_purchase_in ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('bd_purchase_in') IS NOT NULL AND COL_LENGTH('dbo.bd_purchase_in', N'附件4') IS NULL ALTER TABLE bd_purchase_in ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('bd_purchase_in') IS NOT NULL AND COL_LENGTH('dbo.bd_purchase_in', N'附件5') IS NULL ALTER TABLE bd_purchase_in ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('bd_purchase_in') IS NOT NULL AND COL_LENGTH('dbo.bd_purchase_in', N'附件6') IS NULL ALTER TABLE bd_purchase_in ADD [附件6] nvarchar(500) NULL;
GO

-- ══════════ 2. 字段元数据(两面板各 6 行;place=header,seq 91..96 紧随主表头段) ══════════
DELETE FROM yj_field WHERE panel_code IN ('PU_ORDER','PURCHASE_IN') AND col_name LIKE N'附件%';
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('PU_ORDER', N'附件1', N'附件1', N'附件', NULL, NULL, NULL, NULL, N'header', 91, 220, 1, 0, 0, 1),
('PU_ORDER', N'附件2', N'附件2', N'附件', NULL, NULL, NULL, NULL, N'header', 92, 220, 1, 0, 0, 1),
('PU_ORDER', N'附件3', N'附件3', N'附件', NULL, NULL, NULL, NULL, N'header', 93, 220, 1, 0, 0, 1),
('PU_ORDER', N'附件4', N'附件4', N'附件', NULL, NULL, NULL, NULL, N'header', 94, 220, 1, 0, 0, 1),
('PU_ORDER', N'附件5', N'附件5', N'附件', NULL, NULL, NULL, NULL, N'header', 95, 220, 1, 0, 0, 1),
('PU_ORDER', N'附件6', N'附件6', N'附件', NULL, NULL, NULL, NULL, N'header', 96, 220, 1, 0, 0, 1),
('PURCHASE_IN', N'附件1', N'附件1', N'附件', NULL, NULL, NULL, NULL, N'header', 91, 220, 1, 0, 0, 1),
('PURCHASE_IN', N'附件2', N'附件2', N'附件', NULL, NULL, NULL, NULL, N'header', 92, 220, 1, 0, 0, 1),
('PURCHASE_IN', N'附件3', N'附件3', N'附件', NULL, NULL, NULL, NULL, N'header', 93, 220, 1, 0, 0, 1),
('PURCHASE_IN', N'附件4', N'附件4', N'附件', NULL, NULL, NULL, NULL, N'header', 94, 220, 1, 0, 0, 1),
('PURCHASE_IN', N'附件5', N'附件5', N'附件', NULL, NULL, NULL, NULL, N'header', 95, 220, 1, 0, 0, 1),
('PURCHASE_IN', N'附件6', N'附件6', N'附件', NULL, NULL, NULL, NULL, N'header', 96, 220, 1, 0, 0, 1);
GO

-- ══════════ 3. 收尾自检:两面板各应为 6 列 + 6 字段行 + 0 孤儿 ══════════
SELECT p.panel_code,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = p.head_table_object_id
          AND c.name IN (N'附件1',N'附件2',N'附件3',N'附件4',N'附件5',N'附件6')) AS head_attach_cols,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code AND f.data_type = N'附件') AS attach_fields,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code
          AND f.col_name LIKE N'附件%' AND COL_LENGTH('dbo.' + p.head_table, f.col_name) IS NULL) AS orphan_attach_fields
FROM (SELECT panel_code, head_table, OBJECT_ID('dbo.' + head_table) AS head_table_object_id
      FROM yj_panel WHERE panel_code IN ('PU_ORDER','PURCHASE_IN')) p;
PRINT N'migrate-po-pi-attach 完成:采购订单/采购入库单各补 6 附件列位(头表 6 列 + yj_field 6 行)';
GO
