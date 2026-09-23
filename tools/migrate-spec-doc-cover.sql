-- migrate-spec-doc-cover.sql — 规格书封面按设计重排(2026-09-18,用户口径)
--
-- 设计源:《产品开发\2.产品文件\2.1规格书\规格书细分.xlsx》
--          sheet「封面（产品信息）」= 封面(首页)版式
--          范围 B5:E18 / 11 个合并区 / 4 列(标签1列 + 值3列)
--
-- 设计封面逐行(标签 → 值示例):
--   [B5] 惠州市银嘉环保科技有限公司 ................ [D5] 编号(值在右下,由报告头渲染)
--   [B6:D6] 产品规格书(居中大标题)
--   B7  编 号         → C7:D7  C-95-33
--   B8  产品类别       → C8:D8  伊可普高品质功能炭棒
--   B9  客户名称       → C9:D9  青岛伊可普
--   B10 客户料号       → C10:D10 3-01-01-0014
--   B11 客户项目名称    → C11:D11 伊可普需求3
--   B12 应用场景       → C12:D12 抽水壶
--   B13 整体规格参数    → C13:D13 35*13*99
--   B14 产品主要性能    → C14:D14 (设计此格为空 —— 该行确实占位)
--   B15 版 本         → C15:D15 V20260624
--   B17 制订/日期 | 审核/日期 | 批准/日期   (三组签订栏,跨三列)
--   B18 陈秀丽/2026/06/24 (姓名与日期合写一格)
--
-- 本脚本只做**字段层**改动(封面字段顺序是前端配置的事,见 recordSheetConfigs.js):
--   · 新增 [产品类别] 字段:按用户口径**参照 RD_PROD_INFO.产品类别**(不另存字典)
--     —— 产品信息表已有该字段(20 个选项),规格书新建时经参照带出,避免同一事实两处维护。
--   · [名称] 从封面退出(设计封面无「名称」行);字段本身保留可用(列表/搜索仍用),不动。
--   · 封面 9 行的顺序、标签样式在 recordSheetConfigs.RD_SPEC_DOC.cover 里声明。
--
-- 签名栏口径(用户确认):沿用既有三列 制订日期/审核日期/批准日期 存「姓名/日期」合写串
--   —— 这三列本就是 nvarchar(200),历史值即 `陈秀丽/2026/06/24` 形态,零结构变更。
--
-- 幂等:COL_LENGTH / NOT EXISTS,可重复执行。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ═══ 新增 [产品类别] 列(参照 产品信息表.产品类别,带出的是产品信息表里选定的品类) ═══
BEGIN TRY
IF COL_LENGTH('rd_spec_doc_head', '产品类别') IS NULL ALTER TABLE rd_spec_doc_head ADD [产品类别] nvarchar(120) NULL;
END TRY BEGIN CATCH PRINT N'规格书 产品类别 加列跳过(无 DDL 权限?)'; END CATCH;
GO

INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.ref_panel, v.ref_field, v.display_field,
       v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  -- seq 40:设计封面把「产品类别」排在 编号(30) 之后、客户名称(60) 之前
  ('RD_SPEC_DOC', N'产品类别', N'产品类别', N'参照', N'RD_PROD_INFO', N'产品类别', N'产品类别',
   N'header', 40, 180, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
       place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- ═══ 核对:封面 9 行各自的字段是否就位 ═══
PRINT N'--- 设计封面 9 行 → yj_field 落点 ---';
SELECT seq, label, col_name, data_type,
       CASE WHEN ref_panel IS NULL THEN N'' ELSE ref_panel + N'.' + ISNULL(ref_field, N'') END AS ref_to,
       editable, required, hidden, visible
FROM yj_field
WHERE panel_code = 'RD_SPEC_DOC' AND place = N'header'
  AND col_name IN (N'编号', N'产品类别', N'客户名', N'客户料号', N'客户项目名称',
                   N'应用场景', N'整体规格参数', N'产品主要性能', N'版本')
ORDER BY seq;

PRINT N'--- 签字栏三列(存「姓名/日期」合写串,本脚本不动)---';
SELECT c.name, t.name AS type, c.max_length, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('rd_spec_doc_head')
  AND c.name IN (N'制订日期', N'审核日期', N'批准日期')
ORDER BY c.column_id;
