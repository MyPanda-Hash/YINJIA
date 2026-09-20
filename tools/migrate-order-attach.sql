-- migrate-order-attach.sql — 订单类单据补 6 附件列位(与送料暂收单 SL_RECV 同款)
-- 2026-09-20 用户口径:所有订单都可以上传附件,按送料暂收单的形式改。
--   范围(6 个"订单"面板,均有头表,附件名可镜像回头列):
--     采购订单 PU_ORDER / 销售订单 SO_ORDER / 生产加工单 MANU_ORDER /
--     委外加工单 OUTSOURCE_ORDER / 生产工单 WO_ORDER / 客户订单 KHDD
--   形式(与 SL_RECV / QC_INSP / QC_RETURN 完全一致):
--     头表 6 个 nvarchar(500) 列位(附件1..附件6);yj_field 6 行 data_type=N'附件' place=header;
--     页面只渲染 1 个附件格聚合展示,上传按序占第一个空余列位,文件实体存 yj_attachment
--     (锚点 = panelCode + 单据编号 + 列位名),上传/删除后服务端把文件名串镜像回头列(打印只见文件名)。
--     前端零结构改动:附件区由 yj_field.data_type 驱动。
-- 说明:CGD 采购单(遗留 Porder,无头表 → 文件名无法镜像回头列)不在本次范围。
-- 幂等:逐列判存 + 清旧插新 + NOT EXISTS。
SET NOCOUNT ON;

-- ══════════ 1. 各订单头表补 6 个附件列位(逐列独立判断,混合状态可收敛) ══════════
IF OBJECT_ID('bd_pu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_pu_order', N'附件1') IS NULL ALTER TABLE bd_pu_order ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('bd_pu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_pu_order', N'附件2') IS NULL ALTER TABLE bd_pu_order ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('bd_pu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_pu_order', N'附件3') IS NULL ALTER TABLE bd_pu_order ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('bd_pu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_pu_order', N'附件4') IS NULL ALTER TABLE bd_pu_order ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('bd_pu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_pu_order', N'附件5') IS NULL ALTER TABLE bd_pu_order ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('bd_pu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_pu_order', N'附件6') IS NULL ALTER TABLE bd_pu_order ADD [附件6] nvarchar(500) NULL;

IF OBJECT_ID('bd_so_order') IS NOT NULL AND COL_LENGTH('dbo.bd_so_order', N'附件1') IS NULL ALTER TABLE bd_so_order ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('bd_so_order') IS NOT NULL AND COL_LENGTH('dbo.bd_so_order', N'附件2') IS NULL ALTER TABLE bd_so_order ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('bd_so_order') IS NOT NULL AND COL_LENGTH('dbo.bd_so_order', N'附件3') IS NULL ALTER TABLE bd_so_order ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('bd_so_order') IS NOT NULL AND COL_LENGTH('dbo.bd_so_order', N'附件4') IS NULL ALTER TABLE bd_so_order ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('bd_so_order') IS NOT NULL AND COL_LENGTH('dbo.bd_so_order', N'附件5') IS NULL ALTER TABLE bd_so_order ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('bd_so_order') IS NOT NULL AND COL_LENGTH('dbo.bd_so_order', N'附件6') IS NULL ALTER TABLE bd_so_order ADD [附件6] nvarchar(500) NULL;

IF OBJECT_ID('bd_manu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_manu_order', N'附件1') IS NULL ALTER TABLE bd_manu_order ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('bd_manu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_manu_order', N'附件2') IS NULL ALTER TABLE bd_manu_order ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('bd_manu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_manu_order', N'附件3') IS NULL ALTER TABLE bd_manu_order ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('bd_manu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_manu_order', N'附件4') IS NULL ALTER TABLE bd_manu_order ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('bd_manu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_manu_order', N'附件5') IS NULL ALTER TABLE bd_manu_order ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('bd_manu_order') IS NOT NULL AND COL_LENGTH('dbo.bd_manu_order', N'附件6') IS NULL ALTER TABLE bd_manu_order ADD [附件6] nvarchar(500) NULL;

IF OBJECT_ID('bd_outsource_order') IS NOT NULL AND COL_LENGTH('dbo.bd_outsource_order', N'附件1') IS NULL ALTER TABLE bd_outsource_order ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('bd_outsource_order') IS NOT NULL AND COL_LENGTH('dbo.bd_outsource_order', N'附件2') IS NULL ALTER TABLE bd_outsource_order ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('bd_outsource_order') IS NOT NULL AND COL_LENGTH('dbo.bd_outsource_order', N'附件3') IS NULL ALTER TABLE bd_outsource_order ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('bd_outsource_order') IS NOT NULL AND COL_LENGTH('dbo.bd_outsource_order', N'附件4') IS NULL ALTER TABLE bd_outsource_order ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('bd_outsource_order') IS NOT NULL AND COL_LENGTH('dbo.bd_outsource_order', N'附件5') IS NULL ALTER TABLE bd_outsource_order ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('bd_outsource_order') IS NOT NULL AND COL_LENGTH('dbo.bd_outsource_order', N'附件6') IS NULL ALTER TABLE bd_outsource_order ADD [附件6] nvarchar(500) NULL;

IF OBJECT_ID('wo_order') IS NOT NULL AND COL_LENGTH('dbo.wo_order', N'附件1') IS NULL ALTER TABLE wo_order ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('wo_order') IS NOT NULL AND COL_LENGTH('dbo.wo_order', N'附件2') IS NULL ALTER TABLE wo_order ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('wo_order') IS NOT NULL AND COL_LENGTH('dbo.wo_order', N'附件3') IS NULL ALTER TABLE wo_order ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('wo_order') IS NOT NULL AND COL_LENGTH('dbo.wo_order', N'附件4') IS NULL ALTER TABLE wo_order ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('wo_order') IS NOT NULL AND COL_LENGTH('dbo.wo_order', N'附件5') IS NULL ALTER TABLE wo_order ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('wo_order') IS NOT NULL AND COL_LENGTH('dbo.wo_order', N'附件6') IS NULL ALTER TABLE wo_order ADD [附件6] nvarchar(500) NULL;

IF OBJECT_ID('order_bt') IS NOT NULL AND COL_LENGTH('dbo.order_bt', N'附件1') IS NULL ALTER TABLE order_bt ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('order_bt') IS NOT NULL AND COL_LENGTH('dbo.order_bt', N'附件2') IS NULL ALTER TABLE order_bt ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('order_bt') IS NOT NULL AND COL_LENGTH('dbo.order_bt', N'附件3') IS NULL ALTER TABLE order_bt ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('order_bt') IS NOT NULL AND COL_LENGTH('dbo.order_bt', N'附件4') IS NULL ALTER TABLE order_bt ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('order_bt') IS NOT NULL AND COL_LENGTH('dbo.order_bt', N'附件5') IS NULL ALTER TABLE order_bt ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('order_bt') IS NOT NULL AND COL_LENGTH('dbo.order_bt', N'附件6') IS NULL ALTER TABLE order_bt ADD [附件6] nvarchar(500) NULL;
GO

-- ══════════ 2. 列中文注明(MS_Description,已存在不覆盖) ══════════
DECLARE @t sysname, @c sysname, @d nvarchar(200), @exists int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT tbl, col FROM (VALUES
    ('bd_pu_order',N'附件1'),('bd_pu_order',N'附件2'),('bd_pu_order',N'附件3'),('bd_pu_order',N'附件4'),('bd_pu_order',N'附件5'),('bd_pu_order',N'附件6'),
    ('bd_so_order',N'附件1'),('bd_so_order',N'附件2'),('bd_so_order',N'附件3'),('bd_so_order',N'附件4'),('bd_so_order',N'附件5'),('bd_so_order',N'附件6'),
    ('bd_manu_order',N'附件1'),('bd_manu_order',N'附件2'),('bd_manu_order',N'附件3'),('bd_manu_order',N'附件4'),('bd_manu_order',N'附件5'),('bd_manu_order',N'附件6'),
    ('bd_outsource_order',N'附件1'),('bd_outsource_order',N'附件2'),('bd_outsource_order',N'附件3'),('bd_outsource_order',N'附件4'),('bd_outsource_order',N'附件5'),('bd_outsource_order',N'附件6'),
    ('wo_order',N'附件1'),('wo_order',N'附件2'),('wo_order',N'附件3'),('wo_order',N'附件4'),('wo_order',N'附件5'),('wo_order',N'附件6'),
    ('order_bt',N'附件1'),('order_bt',N'附件2'),('order_bt',N'附件3'),('order_bt',N'附件4'),('order_bt',N'附件5'),('order_bt',N'附件6')
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

-- ══════════ 3. 字段元数据:6 面板 × 附件1..附件6(place=header,seq 91..96) ══════════
DELETE FROM yj_field WHERE panel_code IN ('PU_ORDER','SO_ORDER','MANU_ORDER','OUTSOURCE_ORDER','WO_ORDER','KHDD') AND col_name LIKE N'附件[1-6]';
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT p.panel_code, n.col_name, n.col_name, N'附件', NULL, NULL, NULL, NULL, N'header', n.seq, 220, 1, 0, 0, 1
FROM (VALUES ('PU_ORDER'),('SO_ORDER'),('MANU_ORDER'),('OUTSOURCE_ORDER'),('WO_ORDER'),('KHDD')) p(panel_code)
CROSS JOIN (VALUES (N'附件1',91),(N'附件2',92),(N'附件3',93),(N'附件4',94),(N'附件5',95),(N'附件6',96)) n(col_name, seq);
GO

-- ══════════ 4. 译名:附件1..6 + 附件标签 × 已启用语言(缺则补,已有不覆盖) ══════════
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', k.ref_key, t.locale, REPLACE(t.tpl, '{n}', k.n), 'manual'
FROM (VALUES (N'附件1','1'),(N'附件2','2'),(N'附件3','3'),(N'附件4','4'),(N'附件5','5'),(N'附件6','6')) k(ref_key, n)
CROSS JOIN (VALUES ('en', N'Attachment {n}'), ('ja', N'添付ファイル{n}'), ('ko', N'첨부파일 {n}'),
                   ('de', N'Anhang {n}'), ('fr', N'Pièce jointe {n}'), ('es', N'Adjunto {n}'),
                   ('ru', N'Вложение {n}'), ('vi', N'Tệp đính kèm {n}'), ('th', N'ไฟล์แนบ {n}'),
                   ('zh-TW', N'附件{n}')) t(locale, tpl)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope='field' AND x.ref_key=k.ref_key AND x.locale=t.locale);
GO
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', N'附件', t.locale, t.txt, 'manual'
FROM (VALUES ('en', N'Attachments'), ('ja', N'添付ファイル'), ('ko', N'첨부파일'),
             ('de', N'Anhänge'), ('fr', N'Pièces jointes'), ('es', N'Adjuntos'),
             ('ru', N'Вложения'), ('vi', N'Tệp đính kèm'), ('th', N'ไฟล์แนบ'), ('zh-TW', N'附件')) t(locale, txt)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope='field' AND x.ref_key=N'附件' AND x.locale=t.locale);
GO

-- ══════════ 5. 收尾自检:每面板应为 6 列 + 6 字段行 + 0 孤儿 + 6 词条 ×10 语言 ══════════
SELECT p.panel_code, p.head_table,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.' + p.head_table)
          AND c.name IN (N'附件1',N'附件2',N'附件3',N'附件4',N'附件5',N'附件6')) AS 头表附件列,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code AND f.data_type = N'附件') AS 附件字段行,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code
          AND f.col_name LIKE N'附件%' AND COL_LENGTH('dbo.' + p.head_table, f.col_name) IS NULL) AS 孤儿字段
FROM yj_panel p WHERE p.panel_code IN ('PU_ORDER','SO_ORDER','MANU_ORDER','OUTSOURCE_ORDER','WO_ORDER','KHDD')
ORDER BY p.panel_code;
GO
-- 断言:附件字段行总数应为 36(6 面板 × 6 列位),孤儿必须为 0
SELECT (SELECT COUNT(*) FROM yj_field WHERE panel_code IN ('PU_ORDER','SO_ORDER','MANU_ORDER','OUTSOURCE_ORDER','WO_ORDER','KHDD') AND data_type=N'附件') AS 附件字段行总数;
GO
PRINT N'migrate-order-attach 完成:6 张订单各补 6 附件列位(与送料暂收单同款)';
GO
