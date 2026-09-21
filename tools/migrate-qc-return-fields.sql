-- migrate-qc-return-fields.sql — 暂收退回单 QC_RETURN 补齐退货/报废字段(2026-09-21)
-- ═══════════════════════════════════════════════════════════════════════════════════
-- 参照来源:参照库备份 HSDZ_MES_backup_2026_08_28 里**没有独立的采购退回单**(面板名含「退」= 0 命中),
--   退回语义在参照库是「入库行上的 退料数量/报废数量」+ 菜单「生产退料」(那是制程领料退回,不是采购退回)。
--   因此本单可补的是**通用退货口径字段**,依据见 docs/方案-来料三单对照参照库字段补充.md §3.3。
--
-- 用户口径(2026-09-21):「接着补齐」= 与来料检验单/送料暂收单同批口径
--   · **只用批次号** → 不新增「批号」列(本单既有「批号」字段行保持原样,是否下线见文档待确认项);
--   · 表头/表体落位逐条声明。
--
-- 本次新增 5 个字段:
--   **表头(qc_return)2 个**:退货类型 / 仓库
--   **表体(qc_return_detail)3 个**:不良原因 / 报废数量 / 剩余数量
--
-- 幂等:逐列判存 + 逐行 NOT EXISTS(place 用 LIKE 匹配,避免 query,detail 之类复合位置漏判而重复插入);
--       译名 NOT EXISTS;自检按 place 过滤计数。可重复执行。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ══════════════ 1. 表头列(qc_return)2 个 ══════════════
-- 退货类型:整单退货性质(退供应商/报废/让步接收),与检验单行「处置方式」闭环
IF COL_LENGTH('dbo.qc_return', N'退货类型') IS NULL ALTER TABLE qc_return ADD [退货类型] nvarchar(50) NULL;
-- 仓库:退回出库仓(参照 WH,存仓库名称,同 FINISH_IN/OTHER_IN/MATERIAL_OUT/暂收单口径)
IF COL_LENGTH('dbo.qc_return', N'仓库') IS NULL ALTER TABLE qc_return ADD [仓库] nvarchar(100) NULL;
GO

-- ══════════════ 2. 表体列(qc_return_detail)3 个 ══════════════
-- 不良原因:行级原因归类(头「退货原因」太粗),参照不合格原因档案 REJECT
IF COL_LENGTH('dbo.qc_return_detail', N'不良原因') IS NULL ALTER TABLE qc_return_detail ADD [不良原因] nvarchar(100) NULL;
-- 报废数量:不合格里作报废处理的量(与「退货数量」分开:退货=退供应商,报废=就地报废)
IF COL_LENGTH('dbo.qc_return_detail', N'报废数量') IS NULL ALTER TABLE qc_return_detail ADD [报废数量] decimal(18,4) NULL;
-- 剩余数量:本行退货后仍余的量(与暂收单同口径,参照库入库行同名存储式字段)
IF COL_LENGTH('dbo.qc_return_detail', N'剩余数量') IS NULL ALTER TABLE qc_return_detail ADD [剩余数量] decimal(18,4) NULL;
GO

-- ══════════════ 3. 新列中文注明(AGENTS.md 强制) ══════════════
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_return') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_return'),'退货类型','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'退货类型(退供应商/报废/让步接收;与来料检验单行「处置方式」闭环)', N'SCHEMA',N'dbo',N'TABLE',N'qc_return',N'COLUMN',N'退货类型';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_return') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_return'),'仓库','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓库(退回出库仓,参照仓库档案 WH,存仓库名称)', N'SCHEMA',N'dbo',N'TABLE',N'qc_return',N'COLUMN',N'仓库';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_return_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_return_detail'),'不良原因','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'不良原因(行级原因归类,参照不合格原因档案 REJECT;头「退货原因」为整单说明)', N'SCHEMA',N'dbo',N'TABLE',N'qc_return_detail',N'COLUMN',N'不良原因';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_return_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_return_detail'),'报废数量','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'报废数量(不合格中就地报废的量;与「退货数量」=退供应商分开记账)', N'SCHEMA',N'dbo',N'TABLE',N'qc_return_detail',N'COLUMN',N'报废数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_return_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_return_detail'),'剩余数量','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'剩余数量(本行退货后仍余的量;参照库入库行同名存储式字段)', N'SCHEMA',N'dbo',N'TABLE',N'qc_return_detail',N'COLUMN',N'剩余数量';
GO

-- ══════════════ 4. yj_field 字段注册(表头 2 + 表体 3) ══════════════
-- 表头:退货类型 45 / 仓库 46 接在「供应商(40)」后、「退货原因(50)」前
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'退货类型' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RETURN', N'退货类型', N'退货类型', N'下拉框', N'SELECT v FROM (VALUES (N''退供应商''),(N''报废''),(N''让步接收'')) AS t(v)', NULL, NULL, NULL, N'header', 45, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'仓库' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RETURN', N'仓库', N'仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'query,header', 46, 150, 1, 0, 0, 1);
-- 表体:不良原因 255 / 报废数量 260 / 剩余数量 265,接在「批号(250)」后
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'不良原因' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RETURN', N'不良原因', N'不良原因', N'参照', NULL, N'REJECT', N'不合格原因', N'不合格原因', N'query,detail', 255, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'报废数量' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RETURN', N'报废数量', N'报废数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 260, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'剩余数量' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RETURN', N'剩余数量', N'剩余数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 265, 100, 1, 0, 0, 1);
GO

-- ══════════════ 5. 译名(10 语言;已存在的不覆盖) ══════════════
IF OBJECT_ID('tempdb..#ret_tr') IS NOT NULL DROP TABLE #ret_tr;
CREATE TABLE #ret_tr (label nvarchar(50), locale varchar(10), txt nvarchar(200));
INSERT INTO #ret_tr (label, locale, txt) VALUES
 (N'退货类型','en',N'Return Type'),(N'退货类型','ja',N'返品タイプ'),(N'退货类型','ko',N'반품 유형'),
 (N'退货类型','de',N'Rückgabeart'),(N'退货类型','fr',N'Type de retour'),(N'退货类型','es',N'Tipo de devolución'),
 (N'退货类型','ru',N'Тип возврата'),(N'退货类型','th',N'ประเภทการคืนสินค้า'),(N'退货类型','vi',N'Loại trả hàng'),
 (N'退货类型','zh-TW',N'退貨類型'),
 (N'不良原因','en',N'Defect Reason'),(N'不良原因','ja',N'不良原因'),(N'不良原因','ko',N'불량 원인'),
 (N'不良原因','de',N'Fehlergrund'),(N'不良原因','fr',N'Cause du défaut'),(N'不良原因','es',N'Causa del defecto'),
 (N'不良原因','ru',N'Причина брака'),(N'不良原因','th',N'สาเหตุของเสีย'),(N'不良原因','vi',N'Nguyên nhân lỗi'),
 (N'不良原因','zh-TW',N'不良原因'),
 (N'仓库','zh-TW',N'倉庫');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', t.label, t.locale, t.txt, 'manual' FROM #ret_tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                  WHERE x.scope='field' AND x.ref_key=t.label AND x.locale=t.locale);
GO

-- ══════════════ 6. 自检 ══════════════
-- 「报废数量/剩余数量」在来料检验单/送料暂收单已各自补过字段行,此处只查本面板 + 按 place 过滤
DECLARE @h int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_RETURN' AND place LIKE '%header%'
    AND col_name IN (N'退货类型',N'仓库'));
DECLARE @d int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_RETURN' AND place LIKE '%detail%'
    AND col_name IN (N'不良原因',N'报废数量',N'剩余数量'));
-- 译名按去重后的 (label,locale) 组数判(yj_translation 历史有重复行)
DECLARE @tr int = (SELECT COUNT(*) FROM (
    SELECT DISTINCT ref_key, locale FROM yj_translation WHERE scope='field'
      AND ref_key IN (N'退货类型',N'不良原因',N'仓库',N'报废数量',N'剩余数量')
      AND locale IN ('en','ja','ko','de','fr','es','ru','th','vi','zh-TW')) d);
IF @h <> 2 OR @d <> 3
    RAISERROR(N'[qc-return-fields] 自检失败:表头 %d(应 2)/表体 %d(应 3)', 16, 1, @h, @d);
IF @tr <> 50
    RAISERROR(N'[qc-return-fields] 自检失败:译名 %d 组(应 50 = 5 标签 × 10 语言)', 16, 1, @tr);
IF @h = 2 AND @d = 3 AND @tr = 50
    PRINT N'[qc-return-fields] 自检通过:表头 2 + 表体 3 = 5 字段,译名 5×10=50 组(未新增「批号」列)';
GO
