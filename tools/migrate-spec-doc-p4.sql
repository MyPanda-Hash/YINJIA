-- migrate-spec-doc-p4.sql — 规格书第 4 页(成品及包装运输)按设计补全(2026-09-18)
--
-- 设计源:《规格书细分.xlsx》sheet「成品及包装运输」(范围 B4:G34,0 个合并区)。
-- 设计逐节(6 节,现实现只有 3 节):
--   [B4]  1.关键物料列表        [E4] 由材料库引用:输入物料编号自动引入
--        表头 B6:序号 | 物料编码 | 物料名称 | 规格参数 | 数量 | 备注
--        样例行:1 | C-95-33 | 烧结炭棒 | 35*13*99 | 1 | /
--                2 | YJ-JPL-56 | 无纺布（白色130g) | 86±1mm宽（卷布） | 1 | 两边各留：5-8mm
--   [B13] 2.炭棒处理要求        ← **本轮新增**
--        B15:炭棒有无黑要求、有颗粒物处理要求;
--   [B17] 3.包装方式
--        （1）按照包装规范进行包装作业;
--        （2）纸箱外层左上角黏贴白色标签,标签内容包括:采购单号、物料编号、生产批号、包装箱号等信息;
--   [B22] 4.出货检验报告        ← **本轮新增**
--        B23:出货时附上产品出货检验报告
--   [B25] 5.运输要求
--        B27:产品在运输中应避免冲击、挤压、雨淋、受潮及化学品腐蚀。
--   [B30] 6.存储环境
--        B32:产品应贮存在通风良好、干燥的室内,不得与酸、碱及有腐蚀性的物品物品放置一起。
--
-- 本脚本只做**字段层**:新增 2 节的落库列 + 字段 + 字段级默认文案。
-- 节的顺序/编号/归属(哪一节在哪页)在 recordSheetConfigs.js 里声明。
--
-- ⚠ 设计原文与既有实现有一处**编号冲突**需记录:
--   现实现把物料列表叫「5.关键物料列表」、包装/运输/存储叫 6/7/8,
--   而设计里是 **1.关键物料列表 / 3.包装方式 / 5.运输要求 / 6.存储环境**。
--   本轮**照设计原文**改成 1..6(用户口径「按这里面的来」)。
--
-- 幂等:COL_LENGTH / NOT EXISTS,可重复执行。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ═══ 新增两节落库列 ═══
BEGIN TRY
IF COL_LENGTH('rd_spec_doc_head', '炭棒处理要求') IS NULL ALTER TABLE rd_spec_doc_head ADD [炭棒处理要求] nvarchar(2000) NULL;
IF COL_LENGTH('rd_spec_doc_head', '出货检验报告') IS NULL ALTER TABLE rd_spec_doc_head ADD [出货检验报告] nvarchar(2000) NULL;
END TRY BEGIN CATCH PRINT N'规格书 P4 加列跳过(无 DDL 权限?)'; END CATCH;
GO

-- ═══ 新增字段(label 即数据键;正文类字段放 seq 160/165 之间,与既有 包装方式160/运输要求170 编排)═══
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_SPEC_DOC', v.col, v.label, N'文本', N'header', v.seq, 260, 1, 0, 0, 1
FROM (VALUES
  (N'炭棒处理要求', N'炭棒处理要求', 155),
  (N'出货检验报告', N'出货检验报告', 165)
) AS v(col, label, seq)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = 'RD_SPEC_DOC' AND f.col_name = v.col AND f.place = N'header');
GO

-- ═══ 字段级默认文案(照设计原文;前端 sectionDefaults 同源,此处落库供后端/报表侧一致)═══
UPDATE yj_field SET alias = N'炭棒有无黑要求、有颗粒物处理要求；'
WHERE panel_code = 'RD_SPEC_DOC' AND col_name = N'炭棒处理要求' AND (alias IS NULL OR alias = N'');

UPDATE yj_field SET alias = N'出货时附上产品出货检验报告'
WHERE panel_code = 'RD_SPEC_DOC' AND col_name = N'出货检验报告' AND (alias IS NULL OR alias = N'');
GO

-- ═══ 核对:设计第 4 页 6 节各自的落点 ═══
PRINT N'--- 成品及包装运输 6 节 → yj_field 落点 ---';
SELECT seq, label, col_name, data_type, hidden, visible
FROM yj_field
WHERE panel_code = 'RD_SPEC_DOC' AND place = N'header'
  AND col_name IN (N'炭棒处理要求', N'包装方式', N'出货检验报告', N'运输要求', N'存储环境')
ORDER BY seq;

PRINT N'--- 物料清单列(设计 B6:序号|物料编码|物料名称|规格参数|数量|备注)---';
SELECT seq, label, col_name
FROM yj_field
WHERE panel_code = 'RD_SPEC_DOC' AND place = N'detail'
  AND col_name IN (N'序号', N'物料编码', N'物料名称', N'规格参数', N'数量', N'备注')
ORDER BY seq;
