-- migrate-rd-2026-design.sql — 研发管理 × 产品开发最新设计 字段能力层补齐(Phase 1)
--
-- 依据:docs/design/研发管理-面板与设计对照.md + docs/design/研发管理-新面板设计与改动方案.md
-- 会话:2026-09-18 grill 会话。对照源:C:\Users\x1787\OneDrive\Desktop\产品开发\产品开发
--
-- 【范围】本脚本只做**字段能力层**:加物理列 + 登记 yj_field + label 对齐 + 字典。
--         不含 Phase 2(RD_PROGRESS 18 列,见 migrate-rd-progress-18cols.sql)、
--         不含 Phase 4/5(组装标准库与新增 2 面板)。
--
-- 【三条硬约束(违反即数据事故)】
--   1. **col_name 一律不改** —— 数据键是中文,改则历史单据字段全丢。本脚本的 label 对齐只 UPDATE label。
--   2. **label 是译名键** —— 任何 label 改动必须同步 tools/i18n-rd-2026-design.sql,否则英文界面显中文。
--   3. **新列一律 required=0** —— 文书面板归档后可再保存,给历史为空的列加必填会卡死老单(幽灵必填)。
--
-- 幂等:全部 IF NOT EXISTS / COL_LENGTH / 条件 UPDATE,可重复执行。
-- 运行(UTF-8 无 BOM):SqlRunner 或 sqlcmd -f 65001
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ═══════════════════════════════════════════════════════════════════
-- A. RD_PROD_INFO 产品信息表 —— 三分类字段收口 + 报告头签名格 + 两级审核人
--    实测(2026-09-18):现有 产品类别=功能语义(阻垢/除铅/…7 项)、产品分类=管控等级
--    (重点产品/KPC产品/其他),都不是设计要的名字。处置:新增两列承接搬迁,旧列退化为历史列。
-- ═══════════════════════════════════════════════════════════════════
BEGIN TRY
IF COL_LENGTH('rd_prod_info_head', '客户项目名称') IS NULL ALTER TABLE rd_prod_info_head ADD [客户项目名称] nvarchar(200) NULL;
IF COL_LENGTH('rd_prod_info_head', '产品管控等级') IS NULL ALTER TABLE rd_prod_info_head ADD [产品管控等级] nvarchar(50)  NULL;
IF COL_LENGTH('rd_prod_info_head', '产品功能类别') IS NULL ALTER TABLE rd_prod_info_head ADD [产品功能类别] nvarchar(200) NULL;
IF COL_LENGTH('rd_prod_info_head', '编辑人')       IS NULL ALTER TABLE rd_prod_info_head ADD [编辑人]       nvarchar(50)  NULL;
IF COL_LENGTH('rd_prod_info_head', '审核人一级')   IS NULL ALTER TABLE rd_prod_info_head ADD [审核人一级]   nvarchar(50)  NULL;
IF COL_LENGTH('rd_prod_info_head', '审核人二级')   IS NULL ALTER TABLE rd_prod_info_head ADD [审核人二级]   nvarchar(50)  NULL;
END TRY BEGIN CATCH PRINT N'RD_PROD_INFO 加列跳过(无 DDL 权限?)'; END CATCH;
GO

-- 历史值搬迁(同义,幂等靠"新列 IS NULL"):
--   产品类别(功能语义)→ 产品功能类别 ; 产品分类(管控语义)→ 产品管控等级
UPDATE rd_prod_info_head SET [产品功能类别] = [产品类别]
 WHERE [产品功能类别] IS NULL AND ISNULL([产品类别], N'') <> N'';
UPDATE rd_prod_info_head SET [产品管控等级] = [产品分类]
 WHERE [产品管控等级] IS NULL AND ISNULL([产品分类], N'') <> N'';
GO

-- yj_field 登记(seq 避开既有:产品编号30/产品名称40/产品类别50/产品类型60/
-- 产品整体尺寸70/客户料号80/炭棒尺寸90/特殊性能描述100/下单数量110/产品分类120/产品形态130/
-- 客户图纸或规格书140/责任人150/审核人160/备注170 ⇒ 新字段插 42/44/46/50/151/152)
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.dict_sql, v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  ('RD_PROD_INFO', N'客户项目名称', N'客户项目名称', N'文本',   NULL, N'header', 42, 180, 1, 0, 0, 1),
  ('RD_PROD_INFO', N'产品管控等级', N'产品管控等级', N'下拉框',
     N'SELECT v FROM (VALUES (N''重点产品''),(N''KPC产品''),(N''其他'')) AS t(v)', N'header', 44, 120, 1, 0, 0, 1),
  ('RD_PROD_INFO', N'产品功能类别', N'产品功能类别', N'文本',   NULL, N'header', 46, 200, 1, 0, 0, 1),
  ('RD_PROD_INFO', N'编辑人',       N'编辑人',       N'文本',   NULL, N'header', 50, 120, 1, 0, 0, 1),
  ('RD_PROD_INFO', N'审核人一级',   N'审核人（一级审核）', N'文本', NULL, N'header', 151, 120, 1, 0, 0, 1),
  ('RD_PROD_INFO', N'审核人二级',   N'审核人（二级审核）', N'文本', NULL, N'header', 152, 120, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- 产品类别换字典为设计 sheet《产品类别》20 项(历史值已搬到 产品功能类别,不丢)
UPDATE yj_field SET data_type = N'下拉框', dict_sql = N'SELECT v FROM (VALUES
  (N''普通炭棒''),(N''低精度炭棒''),(N''高精度炭棒''),(N''重力式炭棒''),
  (N''氯胺炭棒''),(N''阻垢炭棒''),(N''碱性炭棒''),(N''矿化炭棒''),(N''矿化碱性炭棒''),
  (N''除铅炭棒''),(N''除重金属炭棒''),(N''除VOC炭棒''),(N''多功能炭棒''),
  (N''抑菌/杀菌炭棒''),(N''抑菌阻垢炭棒''),(N''抑菌矿化炭棒''),(N''载银炭棒''),
  (N''口感炭棒''),(N''烧结阻垢棒''),(N''烧结矿化棒'')) AS t(v)'
WHERE panel_code = 'RD_PROD_INFO' AND col_name = N'产品类别';

-- 退化列:值已搬走 ⇒ 列表隐藏、表单保留(复核历史值)。用 hidden=1, visible=1(第 3 类语义)
UPDATE yj_field SET hidden = 1, visible = 1
WHERE panel_code = 'RD_PROD_INFO' AND col_name IN (N'产品分类', N'产品类型');
GO

-- ═══════════════════════════════════════════════════════════════════
-- B. RD_ASM_PROC 组装工艺清单 —— 2 个引用字段(设计标"自动填充规格书")+ 变更履历 2 列
-- ═══════════════════════════════════════════════════════════════════
BEGIN TRY
IF COL_LENGTH('rd_asm_proc_head', '客户项目名称') IS NULL ALTER TABLE rd_asm_proc_head ADD [客户项目名称] nvarchar(200) NULL;
IF COL_LENGTH('rd_asm_proc_head', '产品功能类别') IS NULL ALTER TABLE rd_asm_proc_head ADD [产品功能类别] nvarchar(200) NULL;
-- 变更履历落同一张行表(表区已分块:物料清单/修订记录),新列须在 yj_field 登记 detail,否则保存链丢键
IF COL_LENGTH('rd_asm_proc_detail', '日期')   IS NULL ALTER TABLE rd_asm_proc_detail ADD [日期]   nvarchar(50) NULL;
IF COL_LENGTH('rd_asm_proc_detail', '版本号') IS NULL ALTER TABLE rd_asm_proc_detail ADD [版本号] nvarchar(50) NULL;
END TRY BEGIN CATCH PRINT N'RD_ASM_PROC 加列跳过'; END CATCH;
GO

INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.ref_panel, v.ref_field, v.display_field, v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  ('RD_ASM_PROC', N'客户项目名称', N'客户项目名称', N'参照', N'RD_PROD_INFO', N'客户项目名称', N'客户项目名称', N'header', 32, 180, 1, 0, 0, 1),
  ('RD_ASM_PROC', N'产品功能类别', N'产品功能类别', N'参照', N'RD_PROD_INFO', N'产品功能类别', N'产品功能类别', N'header', 34, 180, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);

INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  ('RD_ASM_PROC', N'日期',   N'日期',   N'文本', N'detail', 45, 110, 1, 0, 0, 1),
  ('RD_ASM_PROC', N'版本号', N'版本号', N'文本', N'detail', 47, 100, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- ═══════════════════════════════════════════════════════════════════
-- C. RD_INSP_PLAN 出货检验计划表 —— 表头 1 + 明细 2 + 检测频率改下拉 + 编写人锁定
-- ═══════════════════════════════════════════════════════════════════
BEGIN TRY
IF COL_LENGTH('rd_insp_plan_head', '产品功能类别') IS NULL ALTER TABLE rd_insp_plan_head ADD [产品功能类别] nvarchar(200) NULL;
IF COL_LENGTH('rd_insp_plan_detail', '序号')     IS NULL ALTER TABLE rd_insp_plan_detail ADD [序号]     nvarchar(20)  NULL;
-- 注意:不能用 [备注] —— DetailMaintainDialog 保存整表覆盖,行类型不同会互相吞掉值。
-- 用独立列名 检验备注,与修订记录/必测项行互不干扰。
IF COL_LENGTH('rd_insp_plan_detail', '检验备注') IS NULL ALTER TABLE rd_insp_plan_detail ADD [检验备注] nvarchar(500) NULL;
END TRY BEGIN CATCH PRINT N'RD_INSP_PLAN 加列跳过'; END CATCH;
GO

INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.ref_panel, v.ref_field, v.display_field, v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  ('RD_INSP_PLAN', N'产品功能类别', N'产品功能类别', N'参照', N'RD_PROD_INFO', N'产品功能类别', N'产品功能类别', N'header', 105, 180, 1, 0, 0, 1),
  ('RD_INSP_PLAN', N'序号',         N'序 号',       N'文本', NULL, NULL, NULL, N'detail',   2,  60, 1, 0, 0, 1),
  ('RD_INSP_PLAN', N'检验备注',     N'备注',        N'文本', NULL, NULL, NULL, N'detail', 120, 140, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);

-- 检测频率:文本 → 下拉框(设计明示"下拉选择",3 个选项为设计原文)
UPDATE yj_field SET data_type = N'下拉框',
       dict_sql = N'SELECT v FROM (VALUES (N''1PCS/一个生产批次''),(N''生产量*1%''),(N''型式检验'')) AS t(v)'
WHERE panel_code = 'RD_INSP_PLAN' AND col_name = N'检测频率';

-- 编写人 = 当前登录用户(设计:"编写人固定登录账号人员")⇒ 只读锁定,
-- 默认值真源 frontend/src/core/panel/docDefaults.js(新增才带出,打开既有单不碰)
UPDATE yj_field SET editable = 0 WHERE panel_code = 'RD_INSP_PLAN' AND col_name = N'编写人';
GO

-- ═══════════════════════════════════════════════════════════════════
-- D. RD_SPEC_DOC 规格书 —— 封面 2 字段(设计《规格书细分》封面页)
-- ═══════════════════════════════════════════════════════════════════
BEGIN TRY
IF COL_LENGTH('rd_spec_doc_head', '客户项目名称') IS NULL ALTER TABLE rd_spec_doc_head ADD [客户项目名称] nvarchar(200) NULL;
IF COL_LENGTH('rd_spec_doc_head', '应用场景')     IS NULL ALTER TABLE rd_spec_doc_head ADD [应用场景]     nvarchar(100) NULL;
END TRY BEGIN CATCH PRINT N'RD_SPEC_DOC 加列跳过'; END CATCH;
GO

INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.ref_panel, v.ref_field, v.display_field, v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  ('RD_SPEC_DOC', N'客户项目名称', N'客户项目名称', N'参照', N'RD_PROD_INFO', N'客户项目名称', N'客户项目名称', N'header', 45, 180, 1, 0, 0, 1),
  ('RD_SPEC_DOC', N'应用场景',     N'应用场景',     N'文本', NULL, NULL, NULL, N'header', 47, 160, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- ═══════════════════════════════════════════════════════════════════
-- E. label 对齐(只改 label;同步译名见 i18n-rd-2026-design.sql)
-- ⚠ col_name 一律不动 —— 数据键永久不变
-- ═══════════════════════════════════════════════════════════════════
UPDATE yj_field SET label = N'主要性能描述' WHERE panel_code = 'RD_PROD_INFO' AND col_name = N'特殊性能描述';
UPDATE yj_field SET label = N'产品负责人'   WHERE panel_code = 'RD_PROD_INFO' AND col_name = N'责任人';
UPDATE yj_field SET label = N'客户名称'     WHERE panel_code = 'RD_SPEC_DOC'  AND col_name = N'客户名';
UPDATE yj_field SET label = N'炭棒内孔要求' WHERE panel_code = 'RD_MOLD_PROC' AND col_name = N'内孔要求';
UPDATE yj_field SET label = N'物料名称'     WHERE panel_code IN ('RD_ASM_PROC', 'RD_ASM_BOM') AND col_name = N'物料名';
UPDATE yj_field SET label = N'表单管理人'   WHERE panel_code = 'RD_INSP_PLAN' AND col_name = N'管理人';
UPDATE yj_field SET label = N'检验项目'     WHERE panel_code = 'RD_INSP_PLAN' AND col_name = N'控制项目';
UPDATE yj_field SET label = N'检验要求'     WHERE panel_code = 'RD_INSP_PLAN' AND col_name = N'控制标准及要求';
UPDATE yj_field SET label = N'原因'         WHERE panel_code = 'RD_ASM_PROC'  AND col_name = N'更改原因';
UPDATE yj_field SET label = N'内容'         WHERE panel_code = 'RD_ASM_PROC'  AND col_name = N'更改内容';
GO

PRINT N'migrate-rd-2026-design.sql 完成(字段能力层 Phase 1)';
GO
