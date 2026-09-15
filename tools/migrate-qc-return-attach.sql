-- migrate-qc-return-attach.sql — 暂收退料单 QC_RETURN 补齐 6 附件列位(2026-09-15)
-- 背景: 暂收退料单的面板/表/字段已按 legacy 口径重建(见 migrate-qc-3docs-rebuild.sql:
--       表头 8 字段 + 明细 25 字段),本次按其「6 个名称字段 + 6 个存储文件字段」口径
--       补齐头部附件列位——与 检验单 QC_INSP / 送料暂收单 SL_RECV 完全同款:
--       头表 6 个 nvarchar(500) 列位,页面只渲染 1 个附件格聚合展示,上传按序占第一个空余列位,
--       文件实体存 yj_attachment(锚点 = panelCode + 单据编号 + 列位名);yj_field 中
--       data_type=N'附件' 的字段由 PanelxList/PanelxForm 从表头网格剔除、单独成「附件」区。
-- 前端零改动: 附件区由 data_type 驱动,且单据号键已用 curDocNo(单据编号||编号) 兜底,
--             label=单号 的面板同样渲染。
-- 幂等: 可重复执行(逐列判存 + 清旧插新 + NOT EXISTS)。
-- 运行(UTF-8 无 BOM,需 -f 65001):
--   docker cp tools/migrate-qc-return-attach.sql mssql2019:/tmp/
--   docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U yinjia -P *** -d HSDZ_MES -C -f 65001 -i /tmp/migrate-qc-return-attach.sql"
SET NOCOUNT ON;

-- ══════════ 1. 头表补 6 个附件列位(逐列独立判断:部分存在的混合状态也能收敛,不整段跳过) ══════════
IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'附件1') IS NULL ALTER TABLE qc_return ADD [附件1] nvarchar(500) NULL;
IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'附件2') IS NULL ALTER TABLE qc_return ADD [附件2] nvarchar(500) NULL;
IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'附件3') IS NULL ALTER TABLE qc_return ADD [附件3] nvarchar(500) NULL;
IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'附件4') IS NULL ALTER TABLE qc_return ADD [附件4] nvarchar(500) NULL;
IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'附件5') IS NULL ALTER TABLE qc_return ADD [附件5] nvarchar(500) NULL;
IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'附件6') IS NULL ALTER TABLE qc_return ADD [附件6] nvarchar(500) NULL;
GO

-- ══════════ 2. 字段元数据:附件 6 行(place=header,seq 91..96 紧随表头字段、在明细 190 之前) ══════════
DELETE FROM yj_field WHERE panel_code = 'QC_RETURN' AND col_name LIKE N'附件%';
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('QC_RETURN', N'附件1', N'附件1', N'附件', NULL, NULL, NULL, NULL, N'header', 91, 220, 1, 0, 0, 1),
('QC_RETURN', N'附件2', N'附件2', N'附件', NULL, NULL, NULL, NULL, N'header', 92, 220, 1, 0, 0, 1),
('QC_RETURN', N'附件3', N'附件3', N'附件', NULL, NULL, NULL, NULL, N'header', 93, 220, 1, 0, 0, 1),
('QC_RETURN', N'附件4', N'附件4', N'附件', NULL, NULL, NULL, NULL, N'header', 94, 220, 1, 0, 0, 1),
('QC_RETURN', N'附件5', N'附件5', N'附件', NULL, NULL, NULL, NULL, N'header', 95, 220, 1, 0, 0, 1),
('QC_RETURN', N'附件6', N'附件6', N'附件', NULL, NULL, NULL, NULL, N'header', 96, 220, 1, 0, 0, 1);
GO

-- ══════════ 3. 译名(附件1..6 为全局面板共享词条,已存在则跳过;缺失时幂等补齐 en/ja) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件1' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件1', 'en', N'Attachment 1', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件2' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件2', 'en', N'Attachment 2', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件3' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件3', 'en', N'Attachment 3', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件4' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件4', 'en', N'Attachment 4', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件5' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件5', 'en', N'Attachment 5', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件6' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件6', 'en', N'Attachment 6', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件1' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件1', 'ja', N'添付ファイル1', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件2' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件2', 'ja', N'添付ファイル2', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件3' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件3', 'ja', N'添付ファイル3', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件4' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件4', 'ja', N'添付ファイル4', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件5' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件5', 'ja', N'添付ファイル5', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件6' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件6', 'ja', N'添付ファイル6', 'manual');
GO

-- ══════════ 4. 收尾自检:列位与字段行数都应为 6 ══════════
SELECT p.panel_code,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.qc_return')
          AND c.name IN (N'附件1',N'附件2',N'附件3',N'附件4',N'附件5',N'附件6')) AS head_attach_cols,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = 'QC_RETURN' AND f.data_type = N'附件') AS attach_fields,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = 'QC_RETURN'
          AND f.col_name LIKE N'附件%' AND COL_LENGTH('dbo.qc_return', f.col_name) IS NULL) AS orphan_attach_fields
FROM yj_panel p WHERE p.panel_code = 'QC_RETURN';
PRINT N'migrate-qc-return-attach 完成:暂收退料单补齐 6 附件列位(头表 6 列 + yj_field 6 行,前端零改动)';
GO
