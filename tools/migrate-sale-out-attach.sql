-- migrate-sale-out-attach.sql — 销售出库单 SALE_OUT 补 6 附件列位(与送料暂收单同款)
-- 2026-09-20 用户口径:需要;采购单 CGD 不做(经核对 CGD 是旧版「采购单」遗留面板——
--   表 Porder / 0 行数据 / 模块「订单管理·单据」,并非「采购订单」;采购订单是 PU_ORDER,已有附件)。
-- 形式与 SL_RECV / 订单一致:头表 6 个 nvarchar(500) 列位(附件1..附件6)+ yj_field 6 行
--   data_type=N'附件' place=header;页面单格聚合,上传按序占位,文件实体存 yj_attachment,
--   上传/删除后服务端把文件名串镜像回头列(bd_sale_out.单据编号)。
-- 注意:bd_sale_out 原有金蝶同步列「附件」/「附件地址」(文本),与本次 附件1..6 不冲突,保持不动。
-- 译名 附件1..6 ×10 语言已在 migrate-order-attach.sql 补齐,无需重复。幂等:逐列判存 + 清旧插新。
SET NOCOUNT ON;

-- ══════════ 1. 头表补 6 列 ══════════
IF OBJECT_ID('bd_sale_out') IS NOT NULL AND COL_LENGTH('dbo.bd_sale_out', N'附件1') IS NULL ALTER TABLE bd_sale_out ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('bd_sale_out') IS NOT NULL AND COL_LENGTH('dbo.bd_sale_out', N'附件2') IS NULL ALTER TABLE bd_sale_out ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('bd_sale_out') IS NOT NULL AND COL_LENGTH('dbo.bd_sale_out', N'附件3') IS NULL ALTER TABLE bd_sale_out ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('bd_sale_out') IS NOT NULL AND COL_LENGTH('dbo.bd_sale_out', N'附件4') IS NULL ALTER TABLE bd_sale_out ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('bd_sale_out') IS NOT NULL AND COL_LENGTH('dbo.bd_sale_out', N'附件5') IS NULL ALTER TABLE bd_sale_out ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('bd_sale_out') IS NOT NULL AND COL_LENGTH('dbo.bd_sale_out', N'附件6') IS NULL ALTER TABLE bd_sale_out ADD [附件6] nvarchar(500) NULL;
GO

-- ══════════ 2. 列中文注明(MS_Description,已存在不覆盖) ══════════
DECLARE @t sysname = 'bd_sale_out', @c sysname, @exists int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col FROM (VALUES (N'附件1'),(N'附件2'),(N'附件3'),(N'附件4'),(N'附件5'),(N'附件6')) v(col);
OPEN cur; FETCH NEXT FROM cur INTO @c;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH('dbo.' + @t, @c) IS NOT NULL
  BEGIN
    SELECT @exists = COUNT(*) FROM sys.extended_properties
      WHERE major_id = OBJECT_ID('dbo.' + @t) AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.' + @t), @c, 'ColumnId') AND name = 'MS_Description';
    IF @exists = 0
      EXEC sp_addextendedproperty N'MS_Description', N'单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)', N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  END
  FETCH NEXT FROM cur INTO @c;
END
CLOSE cur; DEALLOCATE cur;
GO

-- ══════════ 3. 字段元数据:SALE_OUT × 附件1..附件6 ══════════
DELETE FROM yj_field WHERE panel_code = 'SALE_OUT' AND col_name LIKE N'附件[1-6]';
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'SALE_OUT', n.col_name, n.col_name, N'附件', NULL, NULL, NULL, NULL, N'header', n.seq, 220, 1, 0, 0, 1
FROM (VALUES (N'附件1',91),(N'附件2',92),(N'附件3',93),(N'附件4',94),(N'附件5',95),(N'附件6',96)) n(col_name, seq);
GO

-- ══════════ 4. 自检:6 列 + 6 字段行 + 0 孤儿 ══════════
SELECT (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bd_sale_out')
          AND c.name IN (N'附件1',N'附件2',N'附件3',N'附件4',N'附件5',N'附件6')) AS 头表附件列,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = 'SALE_OUT' AND f.data_type = N'附件') AS 附件字段行,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = 'SALE_OUT'
          AND f.col_name LIKE N'附件%' AND COL_LENGTH('dbo.bd_sale_out', f.col_name) IS NULL) AS 孤儿字段;
GO
PRINT N'migrate-sale-out-attach 完成:销售出库单补 6 附件列位';
GO
