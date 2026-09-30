-- migrate-rd-test-apply.sql — 「测试申请单」RD_DOM_TEST 升级为「一张单 三个页签」
-- 设计源:《产品开发\3.实验室使用记录表\测试申请单.xlsx》(3 个 sheet,一比一复刻)
--   页签 0 内部委托-测试申请单     ← sheet 内部1 (受控表单编号 YJ-RIR001)
--   页签 1 销售端-测试/检测申请表  ← sheet 外部   (受控表单编号 YJ-XS002)
--   页签 2 委托测试汇总表          ← sheet 汇总表 (只读派生台账:本面板全部单据)
--
-- 【设计决策 · 2026-09-30 用户口径】
--   ① 不新建面板:沿用 RD_DOM_TEST(改造时库内 0 张单据,零数据风险),菜单项改名「测试申请单」;
--   ② 两张申请表共用 rd_dom_test_detail,靠**物理列 [表区]** 分块(内部申请 / 外部申请)——
--      与成型工艺清单 RD_MOLD_PROC / 组装工艺清单 RD_ASM_PROC 完全同一套做法
--      (见 CONTEXT「表区是物理列而非内存标记」);
--   ③ 汇总表是**只读派生页**,不落库、不占字段(与设计对照文档 §2.11 的口径一致:
--      汇总表属"面板列表视图既有能力",列 = 单据编号/发起人/申请日期/分类/单据状态);
--   ④ 旧「开发性 / 品质委托」两变体按新设计**合并为一张表**:样品信息用 尺寸/配方/密度,
--      紧急程度/期望完成日期/预计完成日期 同表并存;产品编号/产品名称/生产批次 退化为
--      **历史列**(仍注册、不进纸面,历史值不丢)。
--
-- 幂等:加列 IF COL_LENGTH IS NULL;字段行按原 migrate-rd-lab-sheets.sql 同口径 DELETE+INSERT。
-- 用法:java -cp lib\mssql-jdbc.jar SqlRunner.java <jdbcUrl> yinjia env migrate-rd-test-apply.sql
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. rd_dom_test_detail 加列:表区 + 外部申请表 6 列
--    (内部申请表的列 序号/日期/申请人/背景目的/尺寸/配方/密度/方法/标准/目标/组装方式/
--     样品处理/紧急程度/期望完成日期/预计完成日期/备注 早已存在,本页零改动)
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN TRY
IF COL_LENGTH('rd_dom_test_detail', '表区') IS NULL ALTER TABLE rd_dom_test_detail ADD [表区] nvarchar(20) NULL;
END TRY BEGIN CATCH PRINT N'RD_DOM_TEST 加列 表区 跳过'; END CATCH;
GO
BEGIN TRY
IF COL_LENGTH('rd_dom_test_detail', '发起人') IS NULL ALTER TABLE rd_dom_test_detail ADD [发起人] nvarchar(50) NULL;
END TRY BEGIN CATCH PRINT N'RD_DOM_TEST 加列 发起人 跳过'; END CATCH;
GO
BEGIN TRY
IF COL_LENGTH('rd_dom_test_detail', '测试（检测）内容') IS NULL ALTER TABLE rd_dom_test_detail ADD [测试（检测）内容] nvarchar(500) NULL;
END TRY BEGIN CATCH PRINT N'RD_DOM_TEST 加列 测试（检测）内容 跳过'; END CATCH;
GO
BEGIN TRY
IF COL_LENGTH('rd_dom_test_detail', '测试（检测）背景') IS NULL ALTER TABLE rd_dom_test_detail ADD [测试（检测）背景] nvarchar(500) NULL;
END TRY BEGIN CATCH PRINT N'RD_DOM_TEST 加列 测试（检测）背景 跳过'; END CATCH;
GO
BEGIN TRY
IF COL_LENGTH('rd_dom_test_detail', '测试（检测）目标/要求') IS NULL ALTER TABLE rd_dom_test_detail ADD [测试（检测）目标/要求] nvarchar(500) NULL;
END TRY BEGIN CATCH PRINT N'RD_DOM_TEST 加列 测试（检测）目标/要求 跳过'; END CATCH;
GO
BEGIN TRY
IF COL_LENGTH('rd_dom_test_detail', '是否要求送样/支数') IS NULL ALTER TABLE rd_dom_test_detail ADD [是否要求送样/支数] nvarchar(50) NULL;
END TRY BEGIN CATCH PRINT N'RD_DOM_TEST 加列 是否要求送样/支数 跳过'; END CATCH;
GO
BEGIN TRY
IF COL_LENGTH('rd_dom_test_detail', '是否需要提供报告') IS NULL ALTER TABLE rd_dom_test_detail ADD [是否需要提供报告] nvarchar(20) NULL;
END TRY BEGIN CATCH PRINT N'RD_DOM_TEST 加列 是否需要提供报告 跳过'; END CATCH;
GO

-- ── 新列中文注明(AGENTS「新增表必须带中文注明」同口径,改表鼓励补注;幂等可重跑) ──
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_dom_test_detail') AND c.name = N'表区' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'表区（内部申请/外部申请：同一张行表分块，见 recordSheetConfigs.js 的 filterKey）', N'SCHEMA', N'dbo', N'TABLE', N'rd_dom_test_detail', N'COLUMN', N'表区';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_dom_test_detail') AND c.name = N'发起人' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'发起人（销售端-测试/检测申请表的申请人）', N'SCHEMA', N'dbo', N'TABLE', N'rd_dom_test_detail', N'COLUMN', N'发起人';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_dom_test_detail') AND c.name = N'测试（检测）内容' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'测试（检测）内容（销售端申请表：要测什么项目）', N'SCHEMA', N'dbo', N'TABLE', N'rd_dom_test_detail', N'COLUMN', N'测试（检测）内容';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_dom_test_detail') AND c.name = N'测试（检测）背景' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'测试（检测）背景（销售端申请表：为什么要测）', N'SCHEMA', N'dbo', N'TABLE', N'rd_dom_test_detail', N'COLUMN', N'测试（检测）背景';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_dom_test_detail') AND c.name = N'测试（检测）目标/要求' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'测试（检测）目标/要求（销售端申请表：目标值与特殊要求）', N'SCHEMA', N'dbo', N'TABLE', N'rd_dom_test_detail', N'COLUMN', N'测试（检测）目标/要求';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_dom_test_detail') AND c.name = N'是否要求送样/支数' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'是否要求送样/支数（销售端申请表）', N'SCHEMA', N'dbo', N'TABLE', N'rd_dom_test_detail', N'COLUMN', N'是否要求送样/支数';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_dom_test_detail') AND c.name = N'是否需要提供报告' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'是否需要提供报告（销售端申请表）', N'SCHEMA', N'dbo', N'TABLE', N'rd_dom_test_detail', N'COLUMN', N'是否需要提供报告';
GO

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. 面板改名:内部委托测试申请单 → 测试申请单(面板编码 RD_DOM_TEST 不变,
--    权限行 yj_role_panel / 单据表 / 单据编号前缀 DT 全部沿用)
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE yj_panel SET panel_name = N'测试申请单', panel_name_en = N'Test Application' WHERE panel_code = 'RD_DOM_TEST';
GO

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. 申请单类型 字典:旧「开发性 / 品质委托」→ 新「内部委托 / 销售端」
--    (改造时该面板 0 张单据;仍留一条幂等 UPDATE 兜底历史值,把两个旧值都收进「内部委托」)
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE rd_dom_test_head SET [申请单类型] = N'内部委托' WHERE [申请单类型] IN (N'开发性', N'品质委托');
GO

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. 字段登记(yj_field)重建 —— 数据键 = label = 表列名(中文),前后端一致
-- ═══════════════════════════════════════════════════════════════════════════
DELETE FROM yj_field WHERE panel_code = 'RD_DOM_TEST';
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
-- ── 查询条件(列表页弹窗:申请单类型 / 文件管理人) ──
('RD_DOM_TEST', N'申请单类型', N'申请单类型', N'下拉框', N'SELECT v FROM (VALUES (N''内部委托''),(N''销售端'')) AS t(v)', NULL, NULL, NULL, N'query', 10, 120, 0, 0, 0, 1),
('RD_DOM_TEST', N'文件管理人', N'文件管理人', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 120, 0, 0, 0, 1);
GO
-- ⚠ 文档编号**刻意不再登记为面板字段**(列与 DF_domtest_docno 默认约束保留,历史值不动):
--   设计里纸面右上角那一格是**受控表单编号**(内部委托 YJ-RIR001 / 销售端 YJ-XS002),
--   逐页常量已由前端 pages[i].docNoStatic 渲染;若把它登记回字段,每张单都会带同一个
--   默认值 YJ-RIR001 ⇒ ButtonService.ensureDocNoUnique(该面板在 DOC_NO_PANELS 内)
--   会在保存第二张单时拒掉(「文档编号不允许重复:YJ-RIR001」,RD_INSP_PLAN 踩过同一个坑)。
--   现在该字段不随表单提交 ⇒ head.get("文档编号") 为空 ⇒ 唯一性校验直接 return(ButtonService:534)。
--   将来若要重新登记该字段,必须同时把 RD_DOM_TEST 移出 DOC_NO_PANELS。
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
-- ── 表头(报告头信息块 = 文件管理人/密级/文件使用范围,与设计第 2-4 行一致) ──
('RD_DOM_TEST', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_DOM_TEST', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_DOM_TEST', N'申请单类型', N'申请单类型', N'下拉框', N'SELECT v FROM (VALUES (N''内部委托''),(N''销售端'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 110, 1, 1, 0, 1),
('RD_DOM_TEST', N'文件管理人', N'文件管理人', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1),
('RD_DOM_TEST', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 60, 80, 1, 0, 0, 1),
('RD_DOM_TEST', N'文件使用范围', N'文件使用范围', N'下拉框', N'SELECT v FROM (VALUES (N''银嘉内部''),(N''公司内''),(N''工程技术中心''),(N''客户项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 70, 110, 1, 0, 0, 1),
('RD_DOM_TEST', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
-- ── 明细:两张申请表共用一张行表,靠 [表区] 分块 ──
('RD_DOM_TEST', N'表区', N'表区', N'下拉框', N'SELECT v FROM (VALUES (N''内部申请''),(N''外部申请'')) AS t(v)', NULL, NULL, NULL, N'detail', 4, 90, 1, 0, 0, 1),
-- 页签 0 内部委托-测试申请单
('RD_DOM_TEST', N'序号', N'序号', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 50, 1, 0, 0, 1),
('RD_DOM_TEST', N'日期', N'日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 90, 1, 0, 0, 1),
('RD_DOM_TEST', N'申请人', N'申请人', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 80, 1, 0, 0, 1),
('RD_DOM_TEST', N'背景/目的', N'测试（检测）背景/目的', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 180, 1, 0, 0, 1),
('RD_DOM_TEST', N'尺寸', N'尺寸', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 90, 1, 0, 0, 1),
('RD_DOM_TEST', N'配方', N'配方', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 90, 1, 0, 0, 1),
('RD_DOM_TEST', N'密度', N'密度', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 74, 1, 0, 0, 1),
('RD_DOM_TEST', N'方法', N'测试（检测）方法', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 240, 1, 0, 0, 1),
('RD_DOM_TEST', N'标准', N'测试（检测）标准', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 120, 1, 0, 0, 1),
('RD_DOM_TEST', N'目标', N'测试（检测）目标', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 110, 1, 0, 0, 1),
('RD_DOM_TEST', N'组装方式', N'组装方式', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 120, 1, 0, 0, 1),
('RD_DOM_TEST', N'样品处理', N'测完后样品样品处理', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 110, 1, 0, 0, 1),
('RD_DOM_TEST', N'紧急程度', N'紧急程度', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 80, 1, 0, 0, 1),
('RD_DOM_TEST', N'期望完成日期', N'期望完成日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 140, 100, 1, 0, 0, 1),
('RD_DOM_TEST', N'预计完成日期', N'预计完成日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 150, 100, 1, 0, 0, 1),
('RD_DOM_TEST', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 160, 120, 1, 0, 0, 1),
-- 历史列(旧「品质委托」变体的样品信息;新设计不画在纸上,登记保留以便历史单据读值)
('RD_DOM_TEST', N'产品编号', N'产品编号', N'文本', NULL, NULL, NULL, NULL, N'detail', 170, 90, 1, 0, 0, 1),
('RD_DOM_TEST', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 180, 100, 1, 0, 0, 1),
('RD_DOM_TEST', N'生产批次', N'生产批次', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 90, 1, 0, 0, 1),
-- 页签 1 销售端-测试/检测申请表
('RD_DOM_TEST', N'发起人', N'发起人', N'文本', NULL, NULL, NULL, NULL, N'detail', 200, 80, 1, 0, 0, 1),
('RD_DOM_TEST', N'测试（检测）内容', N'测试（检测）内容', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 190, 1, 0, 0, 1),
('RD_DOM_TEST', N'测试（检测）背景', N'测试（检测）背景', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 220, 1, 0, 0, 1),
('RD_DOM_TEST', N'测试（检测）目标/要求', N'测试（检测）目标/要求', N'文本', NULL, NULL, NULL, NULL, N'detail', 230, 310, 1, 0, 0, 1),
('RD_DOM_TEST', N'是否要求送样/支数', N'是否要求送样/支数', N'文本', NULL, NULL, NULL, NULL, N'detail', 240, 110, 1, 0, 0, 1),
('RD_DOM_TEST', N'是否需要提供报告', N'是否需要提供报告', N'文本', NULL, NULL, NULL, NULL, N'detail', 250, 100, 1, 0, 0, 1);
GO

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. 译名(yj_translation;scope='field' 按中文标签全局共享,已有则跳过)
--    面板名 scope='panel' 同步改名 —— 旧面板名的译名行保留(历史单据/别处可能仍引用),不删
-- ═══════════════════════════════════════════════════════════════════════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'测试申请单' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'测试申请单', 'en', N'Test Application', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'表区' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'表区', 'en', N'Table Area', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发起人' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发起人', 'en', N'Initiator', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试（检测）内容' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试（检测）内容', 'en', N'Test / Inspection Content', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试（检测）背景' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试（检测）背景', 'en', N'Test / Inspection Background', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试（检测）目标/要求' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试（检测）目标/要求', 'en', N'Test Target / Requirement', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否要求送样/支数' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否要求送样/支数', 'en', N'Sample Required / Qty', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否需要提供报告' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否需要提供报告', 'en', N'Report Required', 'manual');
GO
-- 下拉项的两个新值也是显示层词条(scope='ui' —— TranslationService.translate 只认 ui/field 两个 scope,
-- 写成别的 scope 会被静默忽略;数据键仍是中文,ADR-0001「字典翻、事实不翻」)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='ui' AND ref_key=N'内部委托' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('ui', N'内部委托', 'en', N'Internal Commission', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='ui' AND ref_key=N'销售端' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('ui', N'销售端', 'en', N'Sales Side', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='ui' AND ref_key=N'内部申请' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('ui', N'内部申请', 'en', N'Internal Request', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='ui' AND ref_key=N'外部申请' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('ui', N'外部申请', 'en', N'External Request', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='ui' AND ref_key=N'测试申请单' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('ui', N'测试申请单', 'en', N'Test Application', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='ui' AND ref_key=N'委托测试汇总表' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('ui', N'委托测试汇总表', 'en', N'Commissioned Test Summary', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='ui' AND ref_key=N'内部委托-测试申请单' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('ui', N'内部委托-测试申请单', 'en', N'Internal Commission - Test Application', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='ui' AND ref_key=N'销售端-测试/检测申请表' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('ui', N'销售端-测试/检测申请表', 'en', N'Sales - Test / Inspection Application', 'manual');
GO

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. 打印结果
-- ═══════════════════════════════════════════════════════════════════════════
DECLARE @c int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='RD_DOM_TEST');
DECLARE @d int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('rd_dom_test_detail')
                  AND name IN (N'表区',N'发起人',N'测试（检测）内容',N'测试（检测）背景',N'测试（检测）目标/要求',N'是否要求送样/支数',N'是否需要提供报告'));
PRINT N'测试申请单 RD_DOM_TEST:字段登记 ' + CAST(@c AS nvarchar(10)) + N' 行,新列 ' + CAST(@d AS nvarchar(10)) + N'/7 列';
