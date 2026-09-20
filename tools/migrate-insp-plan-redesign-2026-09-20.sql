-- migrate-insp-plan-redesign-2026-09-20.sql — 出货检验计划表按设计重排为「一张表 7 列」
--
-- 设计源:《产品开发\2.产品文件\3.检验计划表\出货检验项目控制计划.xlsx》(单 sheet)
--   r2  公司名 B2:G2 + 右上角编号 YJ-QR-88          → docNoDefault
--   r3  B3:F4 大标题「出货检验项目控制计划」          → titlePlaceholder
--   r3-r4 信息栏 表单管理人=冯敏 / 密级=保密          → info[] + docDefaults
--   r5  [产品编号 | 客户项目名称 | 使用范围=全公司]    → sections 行1
--   r6  [产品功能类别 | 产品整体尺寸 | 版本号]        → sections 行2
--   r7  [编写人=登录人 | 审核人=冯加劲]               → sections 行3
--   r8  表头:序号/检验项目/检验要求/检验方法/不合格应对措施/检查频率/备注  → cols 7 列
--   r9  模板行(B9:E9 标「自动填充规格书」,F9 三段应对措施,G9 是频率图例)
--   r10 表尾注「若规格书有变动提示管控文件需更新」(B10:H10 跨 7 列) → footerNote
--
-- 【为什么明细一列都不加】rd_insp_plan_detail 现有 13 列已经覆盖设计要的 7 列 + 库模型要的
--   隐藏列:序号/检验类别/控制项目/质量控制内容/检测仪器/控制标准及要求/检验/不合格应对措施/
--   检测频率/取样方式/检验内容/控制方法/备注。
--   那 11 个非序号列恰好就是标准库 insp.plan 的规范字段(toCanonical/toInspRow 一一对应),
--   藏掉就断了库往返 ⇒ 设计只展示 7 列,靠 config 的 cols + hiddenCol 控,不动 visible。
--
-- 【label 即数据键,本轮只动 alias,不动任何 label】
--   设计写的「检验项目 / 检验要求 / 检验方法 / 检查频率」是列名,
--   但 label 改一下,数据键跟着漂移(yj_field.label 就是前端取数的键),且测试断言③会拦。
--   ⇒ 一律用 alias(纯显示层,PanelRegistry.displayName() = alias 非空 ? alias : label),
--     数据键仍是 控制项目 / 控制标准及要求 / 控制方法 / 检测频率。
--   ⚠ 「检验方法」的译名不用建 —— 实测合并词典里它是满 10 语言(ui 侧 9 条 + field 侧 en),
--     建了反而在同键同语言上撞车,详见 i18n-insp-plan-redesign.sql 头部说明。
--
-- 【为什么 产品整体尺寸/客户项目名称 是普通文本字段,不学组装工艺面板做成「参照」】
--   设计在这两格(以及产品功能类别)标的是「自动填充规格书」——值来自**规格书**,
--   不是从产品主数据里挑。做成参照会多出一个手选入口,与设计的单一路径不符;
--   这三个格由前端 autoFillSpec(选完产品编号后拉规格书)回填。
--   组装工艺面板那轮的 产品整体尺寸 走 RD_PROD_INFO 参照,两者取值源不同,故不冲突。
--
-- 【为什么新增 客户项目名称 而不是复用 客户名】规格书里 客户名(客户名称) 与 客户项目名称
--   是**两个不同字段**,复用会让 RD_INSP_PLAN.客户名 同时承担两种语义,
--   且设计头的这一格明确要的是「客户项目名称」。
--
-- 幂等:改列走 IF COL_LENGTH IS NULL;字段行按 (panel_code, col_name, place) NOT EXISTS 去重。
-- 用法:sqlcmd -f 65001 -i tools/migrate-insp-plan-redesign-2026-09-20.sql 或 SqlRunner
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 1. rd_insp_plan_head 加列:设计头 3 个新格
--    宽度对齐**取值源**而非观感:客户项目名称 ← rd_spec_doc_head.客户项目名称(200),
--    产品整体尺寸 ← rd_spec_doc_head.整体规格参数(1000)。窄了会在保存时静默截断。
-- ═══════════════════════════════════════════════════════════════════
BEGIN TRY
IF COL_LENGTH('rd_insp_plan_head', '客户项目名称') IS NULL ALTER TABLE rd_insp_plan_head ADD [客户项目名称] nvarchar(200) NULL;
END TRY BEGIN CATCH PRINT N'RD_INSP_PLAN 加列 客户项目名称 跳过'; END CATCH;
GO
BEGIN TRY
IF COL_LENGTH('rd_insp_plan_head', '产品整体尺寸') IS NULL ALTER TABLE rd_insp_plan_head ADD [产品整体尺寸] nvarchar(1000) NULL;
END TRY BEGIN CATCH PRINT N'RD_INSP_PLAN 加列 产品整体尺寸 跳过'; END CATCH;
GO
BEGIN TRY
IF COL_LENGTH('rd_insp_plan_head', '使用范围') IS NULL ALTER TABLE rd_insp_plan_head ADD [使用范围] nvarchar(100) NULL;
END TRY BEGIN CATCH PRINT N'RD_INSP_PLAN 加列 使用范围 跳过'; END CATCH;
GO

-- 新列补表注释(AGENTS.md:结构改动鼓励补注,已有注释不覆盖)
BEGIN TRY
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('rd_insp_plan_head') AND name = 'MS_Description'
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_insp_plan_head'), '客户项目名称', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'客户项目名称(设计头 C5:D5;选完产品编号后从规格书自动带入)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_insp_plan_head', N'COLUMN', N'客户项目名称';
END TRY BEGIN CATCH PRINT N'RD_INSP_PLAN 列注释 客户项目名称 跳过'; END CATCH;
GO
BEGIN TRY
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('rd_insp_plan_head') AND name = 'MS_Description'
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_insp_plan_head'), '产品整体尺寸', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'产品整体尺寸(设计头 F6;取值源为规格书的 整体规格参数)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_insp_plan_head', N'COLUMN', N'产品整体尺寸';
END TRY BEGIN CATCH PRINT N'RD_INSP_PLAN 列注释 产品整体尺寸 跳过'; END CATCH;
GO
BEGIN TRY
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('rd_insp_plan_head') AND name = 'MS_Description'
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_insp_plan_head'), '使用范围', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'使用范围(设计头 H5,默认「全公司」)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_insp_plan_head', N'COLUMN', N'使用范围';
END TRY BEGIN CATCH PRINT N'RD_INSP_PLAN 列注释 使用范围 跳过'; END CATCH;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 2. 新增 header 字段(设计头的 3 个新格)
--    seq 取夹缝值(82/107/122),只影响通用表单的排列;报告页布局由 recordSheetConfigs.js
--    的 sections 决定,与 seq 无关。
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.ref_panel, v.ref_field, v.display_field, v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  ('RD_INSP_PLAN', N'客户项目名称', N'客户项目名称', N'文本', NULL, NULL, NULL, N'header',  82, 200, 1, 0, 0, 1),
  ('RD_INSP_PLAN', N'产品整体尺寸', N'产品整体尺寸', N'文本', NULL, NULL, NULL, N'header', 107, 200, 1, 0, 0, 1),
  ('RD_INSP_PLAN', N'使用范围',     N'使用范围',     N'文本', NULL, NULL, NULL, N'header', 122, 150, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                   WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- ═══════════════════════════════════════════════════════════════════
-- 3. 显示层改名(alias):把设计列名贴到现有数据键上,label 一律不动
--    ⚠ alias 是 yj_field 行级属性,只落在 RD_INSP_PLAN 这一行 ——
--      控制方法 在别处(若有)仍显旧名,不受影响。检测频率 同理。
-- ═══════════════════════════════════════════════════════════════════
UPDATE yj_field SET alias = N'检验方法'
 WHERE panel_code = N'RD_INSP_PLAN' AND place = N'detail' AND col_name = N'控制方法';
GO
UPDATE yj_field SET alias = N'检查频率'
 WHERE panel_code = N'RD_INSP_PLAN' AND place = N'detail' AND col_name = N'检测频率';
GO

-- ═══════════════════════════════════════════════════════════════════
-- 4. 校验
-- ═══════════════════════════════════════════════════════════════════
-- 4.1 字段全景:应看到 3 个新 header 行 + 两处 alias 生效
SELECT place, seq, col_name, label, ISNULL(alias, N'') AS alias, data_type,
       ISNULL(ref_panel, N'') AS ref_panel, visible
FROM yj_field
WHERE panel_code = N'RD_INSP_PLAN'
ORDER BY place, seq;
GO

-- 4.2 物理列到位
SELECT c.name AS 新列名, t.name AS 类型, c.max_length / 2 AS 字符数
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('rd_insp_plan_head')
  AND c.name IN (N'客户项目名称', N'产品整体尺寸', N'使用范围');
GO

-- 4.3 面板内 label 不得重复(测试断言③的库侧预检)
SELECT label, COUNT(*) AS 条数
FROM yj_field WHERE panel_code = N'RD_INSP_PLAN'
GROUP BY label HAVING COUNT(*) > 1;
GO

PRINT N'migrate-insp-plan-redesign-2026-09-20.sql 完成:一张表 7 列 + 3 个新表头字段 + 2 处 alias';
GO
