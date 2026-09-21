-- migrate-rd-prodinfo-ui.sql — 产品信息表界面调整(2026-09-18 第二轮,用户口径)
--
-- 五项改动:
--   ① 纸张右上角「编号：」前置标识 —— **前端渲染层**改动(RecordSheetPanels 报告头),
--      23 个有 文档编号 的文书面板统一;此脚本不动结构,只在末尾核对列出受影响面板。
--   ② 编辑人与日期上下颠倒 —— 报告头右侧信息块行序。设计纸面为「编号：/编辑人/日期」竖排,
--      现有 info=[单据日期, 编辑人] 把日期放上面 ⇒ 调成 [编辑人, 单据日期]。
--      行序在前端 config(info 数组顺序),此处不改结构;见 recordSheetConfigs.js。
--   ③ 一级/二级审批人**分不同行**且固定填写 冯总 / 秀丽:
--      · label 改为「审核人（一级审批人）」「审核人（二级审批人）」(与前端两行配置一致)
--      · 固定值走 docDefaults.js(新建即带出,与既有默认值同机制,仍可人工改)
--   ④ 产品功能类别 改下拉框:除余氯 / VOC / 重金属
--   ⑤ 炭棒尺寸 默认分三格(内径*外径*长度,照设计《产品信息表内容.xlsx》B13 填写说明原文):
--      新增 [炭棒内径] / [炭棒长度] 两列;[炭棒外径] 复用既有 [炭棒尺寸] 列**改名而来**?
--      —— 不。**不改列名**(铁律:col_name 永久不变),而是:
--        · 既有 [炭棒尺寸] 保留(历史值/整串展示)
--        · 新增 [炭棒内径] / [炭棒外径] / [炭棒长度] 三列承载三格
--          (不把旧列当"外径"用:旧列存的是整串如 `35*13*107`,当外径用会把整串写进去)
--
-- 幂等:IF NOT EXISTS / COL_LENGTH,可重复执行。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ═══ ③ label:两级审核人 ═══
UPDATE yj_field SET label = N'审核人（一级审批人）'
WHERE panel_code = 'RD_PROD_INFO' AND col_name = N'审核人一级';
UPDATE yj_field SET label = N'审核人（二级审批人）'
WHERE panel_code = 'RD_PROD_INFO' AND col_name = N'审核人二级';
GO

-- ═══ ④ 产品功能类别 改下拉框 ═══
UPDATE yj_field SET data_type = N'下拉框',
       dict_sql = N'SELECT v FROM (VALUES (N''除余氯''),(N''VOC''),(N''重金属'')) AS t(v)'
WHERE panel_code = 'RD_PROD_INFO' AND col_name = N'产品功能类别';
GO

-- ═══ ⑤ 炭棒尺寸 拆三格:新增 炭棒内径 / 炭棒外径 / 炭棒长度 ═══
BEGIN TRY
IF COL_LENGTH('rd_prod_info_head', '炭棒内径') IS NULL ALTER TABLE rd_prod_info_head ADD [炭棒内径] nvarchar(50) NULL;
IF COL_LENGTH('rd_prod_info_head', '炭棒外径') IS NULL ALTER TABLE rd_prod_info_head ADD [炭棒外径] nvarchar(50) NULL;
IF COL_LENGTH('rd_prod_info_head', '炭棒长度') IS NULL ALTER TABLE rd_prod_info_head ADD [炭棒长度] nvarchar(50) NULL;
END TRY BEGIN CATCH PRINT N'炭棒三格加列跳过(无 DDL 权限?)'; END CATCH;
GO

INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_PROD_INFO', v.col, v.label, N'文本', N'header', v.seq, v.w, 1, 0, 0, 1
FROM (VALUES
  (N'炭棒内径', N'炭棒内径', 92, 80),
  (N'炭棒外径', N'炭棒外径', 94, 80),
  (N'炭棒长度', N'炭棒长度', 96, 80)
) AS v(col, label, seq, w)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = 'RD_PROD_INFO' AND f.col_name = v.col AND f.place = N'header');

-- 旧的整串 [炭棒尺寸] 退化为历史列(列表隐藏、表单保留,便于与新三格对照)
UPDATE yj_field SET hidden = 1, visible = 1
WHERE panel_code = 'RD_PROD_INFO' AND col_name = N'炭棒尺寸';
GO

-- ═══ 核对 ═══
PRINT N'--- RD_PROD_INFO 报告头信息块 + 相关字段 ---';
SELECT seq, col_name, label, data_type, LEFT(ISNULL(dict_sql, N''), 60) AS dict_head, hidden, visible
FROM yj_field
WHERE panel_code = 'RD_PROD_INFO'
  AND col_name IN (N'编辑人', N'单据日期', N'审核人一级', N'审核人二级', N'产品功能类别',
                   N'炭棒尺寸', N'炭棒内径', N'炭棒外径', N'炭棒长度')
ORDER BY seq;

PRINT N'--- 有 文档编号 的文书面板(前端「编号：」标识覆盖范围 = 23 面)---';
SELECT COUNT(DISTINCT panel_code) AS panels_with_docno
FROM yj_field WHERE col_name = N'文档编号' AND place LIKE '%header%';
GO

PRINT N'migrate-rd-prodinfo-ui.sql 完成';
GO
