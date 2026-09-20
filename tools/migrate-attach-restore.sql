-- migrate-attach-restore.sql — 恢复采购链三单据的 6 附件列位(当前库缺失)
-- 2026-09-20:盘点发现现网库里只有 送料暂收单 SL_RECV 有附件能力,而登记在册的迁移早该给
--   来料检验单 QC_INSP(migrate-qc-3docs-rebuild.sql:qc_insp 建表即含 附件1..6)、
--   暂收退回单 QC_RETURN(migrate-qc-return-attach.sql)、采购入库单 PURCHASE_IN(migrate-po-pi-attach.sql)
--   各补过 6 个附件列位 —— 当前库里这三张单「表无附件列、yj_field 无附件行」(与本机库历史回档有关)。
--   本脚本按同一口径补齐,不重跑那两个会重建/清字段的旧迁移(它们的 DELETE yj_field 会清掉后续脚本加的字段)。
-- 形式与送料暂收单一致:头表 6 个 nvarchar(500) 列位;yj_field 6 行 data_type=N'附件' place=header;
--   文件实体存 yj_attachment,上传/删除后服务端把文件名串镜像回头列。译名已在 migrate-order-attach.sql 补齐。
-- 幂等:逐列判存 + 清旧插新。
SET NOCOUNT ON;

-- ══════════ 1. 三张头表各补 6 列 ══════════
IF OBJECT_ID('bd_purchase_in') IS NOT NULL AND COL_LENGTH('dbo.bd_purchase_in', N'附件1') IS NULL ALTER TABLE bd_purchase_in ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('bd_purchase_in') IS NOT NULL AND COL_LENGTH('dbo.bd_purchase_in', N'附件2') IS NULL ALTER TABLE bd_purchase_in ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('bd_purchase_in') IS NOT NULL AND COL_LENGTH('dbo.bd_purchase_in', N'附件3') IS NULL ALTER TABLE bd_purchase_in ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('bd_purchase_in') IS NOT NULL AND COL_LENGTH('dbo.bd_purchase_in', N'附件4') IS NULL ALTER TABLE bd_purchase_in ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('bd_purchase_in') IS NOT NULL AND COL_LENGTH('dbo.bd_purchase_in', N'附件5') IS NULL ALTER TABLE bd_purchase_in ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('bd_purchase_in') IS NOT NULL AND COL_LENGTH('dbo.bd_purchase_in', N'附件6') IS NULL ALTER TABLE bd_purchase_in ADD [附件6] nvarchar(500) NULL;

IF OBJECT_ID('qc_insp') IS NOT NULL AND COL_LENGTH('dbo.qc_insp', N'附件1') IS NULL ALTER TABLE qc_insp ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('qc_insp') IS NOT NULL AND COL_LENGTH('dbo.qc_insp', N'附件2') IS NULL ALTER TABLE qc_insp ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('qc_insp') IS NOT NULL AND COL_LENGTH('dbo.qc_insp', N'附件3') IS NULL ALTER TABLE qc_insp ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('qc_insp') IS NOT NULL AND COL_LENGTH('dbo.qc_insp', N'附件4') IS NULL ALTER TABLE qc_insp ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('qc_insp') IS NOT NULL AND COL_LENGTH('dbo.qc_insp', N'附件5') IS NULL ALTER TABLE qc_insp ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('qc_insp') IS NOT NULL AND COL_LENGTH('dbo.qc_insp', N'附件6') IS NULL ALTER TABLE qc_insp ADD [附件6] nvarchar(500) NULL;

IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'附件1') IS NULL ALTER TABLE qc_return ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'附件2') IS NULL ALTER TABLE qc_return ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'附件3') IS NULL ALTER TABLE qc_return ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'附件4') IS NULL ALTER TABLE qc_return ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'附件5') IS NULL ALTER TABLE qc_return ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'附件6') IS NULL ALTER TABLE qc_return ADD [附件6] nvarchar(500) NULL;
GO

-- ══════════ 2. 列中文注明(MS_Description,已存在不覆盖) ══════════
DECLARE @t sysname, @c sysname, @exists int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT tbl, col FROM (VALUES
    ('bd_purchase_in',N'附件1'),('bd_purchase_in',N'附件2'),('bd_purchase_in',N'附件3'),('bd_purchase_in',N'附件4'),('bd_purchase_in',N'附件5'),('bd_purchase_in',N'附件6'),
    ('qc_insp',N'附件1'),('qc_insp',N'附件2'),('qc_insp',N'附件3'),('qc_insp',N'附件4'),('qc_insp',N'附件5'),('qc_insp',N'附件6'),
    ('qc_return',N'附件1'),('qc_return',N'附件2'),('qc_return',N'附件3'),('qc_return',N'附件4'),('qc_return',N'附件5'),('qc_return',N'附件6')
  ) v(tbl, col);
OPEN cur;
FETCH NEXT FROM cur INTO @t, @c;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID('dbo.' + @t) IS NOT NULL AND COL_LENGTH('dbo.' + @t, @c) IS NOT NULL
  BEGIN
    SELECT @exists = COUNT(*) FROM sys.extended_properties
      WHERE major_id = OBJECT_ID('dbo.' + @t) AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.' + @t), @c, 'ColumnId') AND name = 'MS_Description';
    IF @exists = 0
      EXEC sp_addextendedproperty N'MS_Description', N'单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)', N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  END
  FETCH NEXT FROM cur INTO @t, @c;
END
CLOSE cur; DEALLOCATE cur;
GO

-- ══════════ 3. 字段元数据:3 面板 × 附件1..附件6 ══════════
DELETE FROM yj_field WHERE panel_code IN ('PURCHASE_IN','QC_INSP','QC_RETURN') AND col_name LIKE N'附件[1-6]';
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT p.panel_code, n.col_name, n.col_name, N'附件', NULL, NULL, NULL, NULL, N'header', n.seq, 220, 1, 0, 0, 1
FROM (VALUES ('PURCHASE_IN'),('QC_INSP'),('QC_RETURN')) p(panel_code)
CROSS JOIN (VALUES (N'附件1',91),(N'附件2',92),(N'附件3',93),(N'附件4',94),(N'附件5',95),(N'附件6',96)) n(col_name, seq);
GO

-- ══════════ 4. 自检:每面板 6 列 + 6 字段行 + 0 孤儿 ══════════
SELECT p.panel_code, p.head_table,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.' + p.head_table)
          AND c.name IN (N'附件1',N'附件2',N'附件3',N'附件4',N'附件5',N'附件6')) AS 头表附件列,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code AND f.data_type = N'附件') AS 附件字段行,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code
          AND f.col_name LIKE N'附件%' AND COL_LENGTH('dbo.' + p.head_table, f.col_name) IS NULL) AS 孤儿字段
FROM yj_panel p WHERE p.panel_code IN ('PURCHASE_IN','QC_INSP','QC_RETURN') ORDER BY p.panel_code;
GO
PRINT N'migrate-attach-restore 完成:采购入库/来料检验/暂收退回各补 6 附件列位';
GO
