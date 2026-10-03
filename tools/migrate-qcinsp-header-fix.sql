-- migrate-qcinsp-header-fix.sql — 来料检验单(QC_INSP)表头治理(2026-09-30)
-- 背景(两台协作机本地库漂移的欠账,本脚本幂等,两账套均执行):
--   ① 表头重复:migrate-chain-field-complete.sql §④(2026-09-21)把 部门/部门名称 的明细位行
--      从 place='detail' 升格为 'header,detail',但表头位本就各有一行(09-14 rebuild seq 60/70,
--      为头/行独立排序故意拆的两行),升格未合并 ⇒ 同名字段两行都占 header 位,页面表头渲染两遍。
--      处置:明细行退回 place='detail'(seq 保持现状=用户在明细网格调好的位置),表头行唯一化。
--   ② 表头布局漂移:表格调整(saveColumnPrefs 此前无 place 过滤)把 部门/部门名称 表头行 seq
--      连带改写成明细位置 290/300,表头调整又把 业务员 挪到 310 ⇒ 表头上半区"变空"。
--      处置:表头行 seq 归位到 09-14 设计布局(业务员 30 / 部门 60 / 部门名称 70)。
--      配套代码(saveColumnPrefs 补 place LIKE '%detail%' 过滤)同提交,防复发。
--   ③ 表头字段缺失:协作者侧 migrate-qc-3docs.sql 登记的 检验员/检验日期/检验方案/总结论 四个
--      表头字段,本地 09-14 rebuild 清字段重插时未含,09-24 migrate-align-merge 只补了表列没补
--      字段行 ⇒ 协作者表头有、本地没有。处置:按协作者同口径补登(检验信息块置表尾 110~140)。
SET NOCOUNT ON;
GO
-- ── 1. 表列兜底(正式库已有;测试库/新库从链上跑时靠这段补齐) ──
IF COL_LENGTH('dbo.qc_insp', N'检验员') IS NULL ALTER TABLE dbo.qc_insp ADD [检验员] nvarchar(50) NULL;
IF COL_LENGTH('dbo.qc_insp', N'检验日期') IS NULL ALTER TABLE dbo.qc_insp ADD [检验日期] nvarchar(20) NULL;
IF COL_LENGTH('dbo.qc_insp', N'检验方案') IS NULL ALTER TABLE dbo.qc_insp ADD [检验方案] nvarchar(100) NULL;
IF COL_LENGTH('dbo.qc_insp', N'总结论') IS NULL ALTER TABLE dbo.qc_insp ADD [总结论] nvarchar(20) NULL;
GO
-- ── 2. 表头重复消解:部门/部门名称 的明细行退回 detail 位(seq 不动) ──
UPDATE yj_field SET place = N'detail'
 WHERE panel_code = 'QC_INSP' AND col_name IN (N'部门', N'部门名称') AND place = N'header,detail';
PRINT N'部门/部门名称 明细行退回 detail: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ── 3. 表头行 seq 归位(09-14 设计布局) ──
UPDATE yj_field SET seq = 30 WHERE panel_code='QC_INSP' AND col_name=N'业务员' AND place LIKE '%header%' AND seq <> 30;
UPDATE yj_field SET seq = 60 WHERE panel_code='QC_INSP' AND col_name=N'部门' AND place='header' AND seq <> 60;
UPDATE yj_field SET seq = 70 WHERE panel_code='QC_INSP' AND col_name=N'部门名称' AND place='header' AND seq <> 70;
GO
-- ── 4. 补登协作者侧四个表头字段(口径=migrate-qc-3docs.sql 138~141 行;检验信息块置表尾) ──
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'检验员' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'检验员', N'检验员', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'检验日期' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'检验日期', N'检验日期', N'日期', NULL, NULL, NULL, NULL, N'header', 120, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'检验方案' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'检验方案', N'检验方案', N'参照', NULL, N'QC_PLAN', N'方案名称', N'方案名称', N'header', 130, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'总结论' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'总结论', N'总结论', N'下拉框', N'SELECT v FROM (VALUES (N''合格''),(N''不合格''),(N''让步接收'')) AS t(v)', NULL, NULL, NULL, N'query,header', 140, 100, 1, 0, 0, 1);
GO
-- ── 5. 译名(共享标签,已有则跳过;检验方案 九语言已存在不重插) ──
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验员' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验员', 'en', N'Inspector', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验员' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验员', 'ja', N'検査員', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验员' AND locale='ko') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验员', 'ko', N'검사원', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验员' AND locale='de') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验员', 'de', N'Prüfer', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验员' AND locale='es') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验员', 'es', N'Inspector', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验员' AND locale='fr') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验员', 'fr', N'Inspecteur', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验员' AND locale='ru') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验员', 'ru', N'Инспектор', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验员' AND locale='th') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验员', 'th', N'ผู้ตรวจสอบ', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验员' AND locale='vi') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验员', 'vi', N'Người kiểm tra', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验日期' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验日期', 'en', N'Inspection Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验日期' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验日期', 'ja', N'検査日', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验日期' AND locale='ko') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验日期', 'ko', N'검사일', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验日期' AND locale='de') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验日期', 'de', N'Prüfdatum', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验日期' AND locale='es') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验日期', 'es', N'Fecha de inspección', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验日期' AND locale='fr') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验日期', 'fr', N'Date d''inspection', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验日期' AND locale='ru') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验日期', 'ru', N'Дата проверки', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验日期' AND locale='th') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验日期', 'th', N'วันที่ตรวจสอบ', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验日期' AND locale='vi') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验日期', 'vi', N'Ngày kiểm tra', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总结论' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总结论', 'en', N'Overall Result', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总结论' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总结论', 'ja', N'総合結論', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总结论' AND locale='ko') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总结论', 'ko', N'종합 결론', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总结论' AND locale='de') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总结论', 'de', N'Gesamtergebnis', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总结论' AND locale='es') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总结论', 'es', N'Resultado general', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总结论' AND locale='fr') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总结论', 'fr', N'Résultat global', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总结论' AND locale='ru') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总结论', 'ru', N'Общий результат', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总结论' AND locale='th') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总结论', 'th', N'ผลสรุป', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总结论' AND locale='vi') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总结论', 'vi', N'Kết luận chung', 'manual');
GO
-- ── 6. 新增列中文注明(幂等;正式库列已存在,仅补注) ──
IF COL_LENGTH('dbo.qc_insp', N'检验员') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp'), N'检验员', 'ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'检验员(表头检验信息块,2026-09-30 与协作机对齐补登)', N'SCHEMA', N'dbo', N'TABLE', N'qc_insp', N'COLUMN', N'检验员';
IF COL_LENGTH('dbo.qc_insp', N'检验日期') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp'), N'检验日期', 'ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'检验日期(表头检验信息块,2026-09-30 与协作机对齐补登)', N'SCHEMA', N'dbo', N'TABLE', N'qc_insp', N'COLUMN', N'检验日期';
IF COL_LENGTH('dbo.qc_insp', N'检验方案') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp'), N'检验方案', 'ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'检验方案(参照 QC_PLAN 方案名称,表头检验信息块)', N'SCHEMA', N'dbo', N'TABLE', N'qc_insp', N'COLUMN', N'检验方案';
IF COL_LENGTH('dbo.qc_insp', N'总结论') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp'), N'总结论', 'ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'总结论(合格/不合格/让步接收,表头检验信息块)', N'SCHEMA', N'dbo', N'TABLE', N'qc_insp', N'COLUMN', N'总结论';
GO
-- ── 7. 自检 + 结果快照 ──
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND place LIKE '%header%' AND col_name IN (N'部门', N'部门名称') GROUP BY col_name HAVING COUNT(*) > 1)
    RAISERROR(N'QC_INSP 表头仍有重复的 部门/部门名称', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_INSP' AND col_name IN (N'检验员', N'检验日期', N'检验方案', N'总结论') AND place LIKE '%header%') <> 4
    RAISERROR(N'QC_INSP 检验信息四字段未登记齐', 16, 1);
SELECT id, place, seq, col_name, label, hidden FROM yj_field WHERE panel_code='QC_INSP' AND place LIKE '%header%' ORDER BY seq, id;
PRINT N'✅ QC_INSP 表头治理完成(重复消解/seq归位/四字段补登)';
GO
