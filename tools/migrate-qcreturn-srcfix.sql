-- migrate-qcreturn-srcfix.sql — 暂收退料单(QC_RETURN)数量丢失修复(2026-09-30)
-- 背景:ButtonService.inspAutoReturn 2026-09-20 版按旧版血统写 line.put("退货数量", 不良数量),
--      而 rebuild 血统(本地两库/服务器全量恢复后)的 qc_return_detail 数量列叫「数量」且无「退货数量」列,
--      标签对不上 → 保存层静默丢弃 → TH-2026-09-0002/0003/0004 等自动退回单行数量全空(实证)。
--      同因:头写入「检验单号」在本地血统无字段行,来源检验单溯源一并丢失。
-- 本脚本(幂等,两账套均执行):
--   ① qc_return 补 检验单号 列(链路溯源:退回单→来源来料检验单);
--   ② 登记头字段行(参照 QC_INSP.单据编号,同旧版血统口径)+译名;
--   ③ 存量回填:退回行 数量 ← form_flow_link.linked_quantity(=检验行不良数量,按行占用对齐);
--      退回头 检验单号 ← link.source_form_no。
--   代码配套修复(同提交):inspAutoReturn 按目标面板注册标签动态写入(退货数量/数量 二择一),
--   不再依赖单侧血统的字面量。
SET NOCOUNT ON;
GO
-- ── 1. 头表补列 ──
IF COL_LENGTH('dbo.qc_return', N'检验单号') IS NULL ALTER TABLE dbo.qc_return ADD [检验单号] nvarchar(60) NULL;
GO
IF COL_LENGTH('dbo.qc_return', N'检验单号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_return') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_return'), N'检验单号', 'ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'检验单号(来源来料检验单单号,审核自动生单/选单带入;2026-09-30 补列回补溯源)', N'SCHEMA', N'dbo', N'TABLE', N'qc_return', N'COLUMN', N'检验单号';
GO
-- ── 2. 头字段登记(旧血统已有则守卫跳过;seq 37=链路追溯位,跟在 采购订单号35/批次号36 后) ──
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'检验单号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RETURN', N'检验单号', N'检验单号', N'参照', NULL, N'QC_INSP', N'单据编号', N'单据编号', N'query,header', 37, 140, 1, 0, 0, 1);
GO
-- ── 3. 译名(共享标签,已有则跳过) ──
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验单号', 'en', N'Inspection No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验单号' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验单号', 'ja', N'検査番号', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验单号' AND locale='ko') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验单号', 'ko', N'검사 번호', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验单号' AND locale='de') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验单号', 'de', N'Prüfnummer', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验单号' AND locale='es') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验单号', 'es', N'N.º de inspección', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验单号' AND locale='fr') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验单号', 'fr', N'N° d''inspection', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验单号' AND locale='ru') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验单号', 'ru', N'№ инспекции', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验单号' AND locale='th') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验单号', 'th', N'เลขที่ตรวจสอบ', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验单号' AND locale='vi') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验单号', 'vi', N'Số kiểm tra', 'manual');
GO
-- ── 4. 存量回填:行 数量 ← 占用表的 linked_quantity(=检验行不良数量) ──
-- ⚠ 2026-10-03 修:数量列的**列名按血统二择一** —— 本机两账套 qc_return_detail 只有「退货数量」
--   (sys.columns 实测,无「数量」列),而远端血统是「数量」。硬写任一名字都会在另一血统上编译失败
--   (「列名 '数量' 无效」)。这正是 ButtonService.inspAutoReturn 那处「按目标面板注册标签择一写入」
--   所兼容的同一件事,故这里同样按**列存在性择名**,再走动态 SQL。
DECLARE @qty sysname =
    CASE WHEN COL_LENGTH('dbo.qc_return_detail', N'数量')     IS NOT NULL THEN N'数量'
         WHEN COL_LENGTH('dbo.qc_return_detail', N'退货数量') IS NOT NULL THEN N'退货数量'
         ELSE NULL END;
IF @qty IS NULL
    RAISERROR(N'qc_return_detail 既无「数量」也无「退货数量」列,无法回填', 16, 1);
ELSE
    EXEC(N'UPDATE d SET d.[' + @qty + N'] = l.linked_quantity, d.asp_user2 = N''migration'', d.asp_time2 = GETDATE()
FROM qc_return_detail d
JOIN form_flow_link l
  ON l.source_panel_code = N''QC_INSP'' AND l.target_panel_code = N''QC_RETURN''
 AND l.target_line_key = N'''' + d.单据编号 + N''#'' + CAST(d.id AS nvarchar(20))
 AND ISNULL(l.linked_quantity, 0) > 0
WHERE d.[' + @qty + N'] IS NULL');
PRINT N'退回行数量回填(列=' + @qty + N'): ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ── 5. 存量回填:头 检验单号 ← link.source_form_no(每张退回单取其唯一源;多源取最早一条防漂) ──
UPDATE h SET h.检验单号 = s.src_no, h.asp_user2 = N'migration', h.asp_time2 = GETDATE()
FROM qc_return h
JOIN (SELECT target_form_no, MIN(source_form_no) AS src_no
        FROM form_flow_link
       WHERE source_panel_code = N'QC_INSP' AND target_panel_code = N'QC_RETURN'
       GROUP BY target_form_no) s ON s.target_form_no = h.单据编号
WHERE ISNULL(h.检验单号, N'') = N'';
PRINT N'退回头检验单号回填: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + ' 行';
GO
-- ── 6. 自检:仍存在 数量为空 且有不良占用的退回行 = 异常 ──
--   同上:数量列名按血统二择一(dynamic SQL),否则本批会在另一血统上编译失败。
DECLARE @qty2 sysname =
    CASE WHEN COL_LENGTH('dbo.qc_return_detail', N'数量')     IS NOT NULL THEN N'数量'
         WHEN COL_LENGTH('dbo.qc_return_detail', N'退货数量') IS NOT NULL THEN N'退货数量'
         ELSE NULL END;
IF @qty2 IS NULL
    RAISERROR(N'qc_return_detail 既无「数量」也无「退货数量」列', 16, 1);
ELSE
    EXEC(N'IF EXISTS (SELECT 1 FROM qc_return_detail d JOIN form_flow_link l
                 ON l.target_panel_code=N''QC_RETURN'' AND l.target_line_key = N'''' + d.单据编号 + N''#'' + CAST(d.id AS nvarchar(20))
                WHERE l.source_panel_code=N''QC_INSP'' AND ISNULL(l.linked_quantity,0) > 0 AND d.[' + @qty2 + N'] IS NULL)
        RAISERROR(N''仍有退回行数量未回填'', 16, 1);');
IF @qty2 IS NOT NULL
    EXEC(N'SELECT TOP 10 d.单据编号, d.物料编码, d.[' + @qty2 + N'] AS 数量, h.检验单号, h.单据状态
  FROM qc_return_detail d JOIN qc_return h ON h.单据编号 = d.单据编号
 WHERE d.单据编号 IN (SELECT DISTINCT target_form_no FROM form_flow_link WHERE target_panel_code=N''QC_RETURN'' AND source_panel_code=N''QC_INSP'')
 ORDER BY d.id DESC');
PRINT N'✅ QC_RETURN 溯源列/字段/存量回填 完成';
GO
