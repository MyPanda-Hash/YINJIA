-- migrate-qc-catalog-auto.sql — 检验目录自动化联动(2026-09-22 用户口径)
-- 逻辑:手工生单(暂收单→检验单)时,按检验单明细物料自动建「检验数据记录」草稿并在检验目录生成对应行;
--       目录行**不可手工编辑**(只由生单与「完成/修改」按钮驱动);检测物料类别由商品档案「所属类别」
--       按物料编码带出(类别为空不归纳);数量=检验单送检数量+单位;批次号靠回填;
--       行上带两个单号:检验单号(可查看详情/跳转)+ 检验数据记录单号(数据挂靠键,因批次号可能尚未回填)。
-- 本脚本:① 目录行补 物料编码/检验单号/检验数据记录单号 三列 + 表注明;
--         ② yj_field 注册(物料编码 query+detail;两个单号 detail 只读);
--         ③ 目录明细字段一律 editable=0(目录不可手工改);
--         ④ 译名。幂等可重跑。
SET NOCOUNT ON;

-- ═════════════ 1. 目录行补列 ═════════════
IF COL_LENGTH('qc_catalog_detail', '物料编码') IS NULL
  ALTER TABLE qc_catalog_detail ADD [物料编码] nvarchar(100) NULL;
IF COL_LENGTH('qc_catalog_detail', '检验单号') IS NULL
  ALTER TABLE qc_catalog_detail ADD [检验单号] nvarchar(60) NULL;
IF COL_LENGTH('qc_catalog_detail', '检验数据记录单号') IS NULL
  ALTER TABLE qc_catalog_detail ADD [检验数据记录单号] nvarchar(60) NULL;
GO

-- ═════════════ 2. 新列中文注明 ═════════════
DECLARE @t sysname = N'qc_catalog_detail';
DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols VALUES
  (N'物料编码',       N'物料编码(生单时由检验单明细带下;检测物料类别按它在商品档案 bs_inv.所属类别 带出)'),
  (N'检验单号',       N'来源来料检验单号(可查看详情/跳转;与检验数据记录单号一起构成挂靠)'),
  (N'检验数据记录单号', N'该行的检验数据记录(检验报告)单号 —— 数据挂这个单号上(批次号可能尚未回填,故不挂批次号)');
DECLARE @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t, @c) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = COLUMNPROPERTY(ep.major_id, @c, 'ColumnId')
                 AND ep.name = 'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
    ELSE
      EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  END
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO
-- 表注明补一句自动化口径
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(N'qc_catalog_detail') AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'来料品质检验目录行表(检验记录目录,每行=一个物料批次;由检验单生单自动生成、不可手工编辑;检测物料类别来自商品档案所属类别)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_catalog_detail';
GO

-- ═════════════ 3. 字段注册 ═════════════
-- 物料编码:查询位(便于按物料查目录)+ 明细只读列
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'物料编码' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'物料编码', N'物料编码', N'文本', NULL, NULL, NULL, NULL, N'query', 60, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'物料编码' AND place=N'detail') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'物料编码', N'物料编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 15, 130, 0, 0, 0, 1);
-- 两个单号:只读列(数据挂靠),纸面带查看详情/跳转
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'检验单号' AND place=N'detail') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'检验单号', N'检验单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'检验数据记录单号' AND place=N'detail') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'检验数据记录单号', N'检验数据记录单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 170, 0, 0, 0, 1);
-- 查询位补 检验单号/检验数据记录单号(按单号反查目录)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'检验单号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'检验单号', N'检验单号', N'文本', NULL, NULL, NULL, NULL, N'query', 70, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'检验数据记录单号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'检验数据记录单号', N'检验数据记录单号', N'文本', NULL, NULL, NULL, NULL, N'query', 80, 170, 0, 0, 0, 1);
GO
-- 目录**不可手工编辑**:明细位字段一律 editable=0(状态只由「完成/修改」按钮改)
UPDATE yj_field SET editable = 0 WHERE panel_code = 'QC_CATALOG' AND place = N'detail';
-- 明细必填校验放开:目录行由生单自动生成(检测物料类别可能因商品档案「所属类别」为空而带不出来),
-- 若仍 required=1,通用保存会被「第 N 行检测物料类别不能为空」拦死
UPDATE yj_field SET required = 0 WHERE panel_code = 'QC_CATALOG' AND place = N'detail';
GO

-- ═════════════ 4. 译名 ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料编码' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料编码', 'en', N'Material Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验数据记录单号' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验数据记录单号', 'en', N'Inspection Record No.', 'manual');
GO

-- ═════════════ 5. 自检 ═════════════
SELECT N'目录行新列' AS k, name FROM sys.columns WHERE object_id = OBJECT_ID('qc_catalog_detail') AND name IN (N'物料编码', N'检验单号', N'检验数据记录单号');
SELECT N'明细字段可编辑数(应为 0)' AS k, CAST(COUNT(*) AS nvarchar(10)) AS v FROM yj_field WHERE panel_code = N'QC_CATALOG' AND place = N'detail' AND editable = 1;
SELECT N'字段清单' AS k, col_name, place, editable FROM yj_field WHERE panel_code = N'QC_CATALOG' ORDER BY CASE place WHEN N'query' THEN 0 WHEN N'header' THEN 1 ELSE 2 END, seq;
PRINT N'检验目录自动化联动迁移完成';
GO
