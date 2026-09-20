-- migrate-asm-proc-redesign-2026-09-20.sql — 组装工艺清单按设计重排为 3 个页签
--
-- 设计源:《产品开发\2.产品文件\2.组装\组装工艺控制.xlsx》,3 个 sheet
--   ① 修订记录                      → 页签 0
--   ② 组装工艺控制-BOM表             → 页签 1
--   ③ 组装工艺控制-组装/包装关键控制清单 → 页签 2
--   标准库源:《…\2.组装\关键控制清单--标准库.xlsx》4 变体(裸棒/机器包布/复合半成品/成品)
--
-- 【为什么明细只需要一处结构改动】rd_asm_proc_detail 早已同时具备三张逻辑表的全部列
--   (工序/工序控制内容/管控要求/检查比例 + 物料名/物料编号/物料规格/外观要求/用量
--    + 更改内容/更改原因/更改时间/责任人/备注),**并且已有 [表区] 列**。
--   唯一的问题是 [表区] 的 yj_field 注册在 place='header'(挂在 rd_asm_proc_head 上),
--   而明细侧的 filterKey/filterVal 分块靠的是 detail 字段 ⇒ 三张表无法分块。
--   本轮把它改挂到 place='detail' 并扩充字典,不新增列、不新增明细字段。
--
-- 【label 即数据键,本轮刻意不动的两处】
--   ① 物料名:设计写「物料名称」,但改 label 会让 RD_ASM_PROC / RD_ASM_BOM / RD_SPEC_DOC
--      三处数据键同时漂移(2026-09-18 已就此定过「不改」)。本轮改用 **alias**
--      (PanelRegistry.displayName() = alias 非空 ? alias : label)做**纯显示层**改名 ——
--      前端 effColLabel() 优先取 displayName,数据键仍是 物料名。
--      ⚠ 只改 RD_ASM_PROC 这一行:alias 是 yj_field 行级属性,组装BOM表面板不受影响。
--   ② 产品整体尺寸:新增为**参照字段**(ref RD_PROD_INFO.产品整体尺寸),与同区
--      客户项目名称/产品功能类别 一致 —— 设计在这三格都标了「自动填充规格书」。
--
-- 【visible=0 而非删行】产品名称/产品种类/整体规格(外径)/整体规格(长度)/成品重量
--   按用户口径「从本面板移除」。置 visible=0 让字段退出编辑面板,但列仍在、数据仍往返
--   (产品名称 还是 产品编号 参照字段的 display_field,删行会连带影响参照回显)。
--
-- 幂等:改列走 IF COL_LENGTH IS NULL;字段行按 (panel_code, col_name, place) NOT EXISTS 去重。
-- 用法:sqlcmd -f 65001 -i tools/migrate-asm-proc-redesign-2026-09-20.sql 或 SqlRunner
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 1. rd_asm_proc_head 加列:产品基本信息第 4 格 + 报告头信息栏 4 格
--    设计③的关键控制清单 sheet 信息栏为 B5:C8 标题 + D5:E5..D8:E8 标签(与 BOM sheet 镜像)
-- ═══════════════════════════════════════════════════════════════════
BEGIN TRY
IF COL_LENGTH('rd_asm_proc_head', '产品整体尺寸') IS NULL ALTER TABLE rd_asm_proc_head ADD [产品整体尺寸] nvarchar(100) NULL;
END TRY BEGIN CATCH PRINT N'RD_ASM_PROC 加列 产品整体尺寸 跳过'; END CATCH;
GO
BEGIN TRY
IF COL_LENGTH('rd_asm_proc_head', '表单管理人') IS NULL ALTER TABLE rd_asm_proc_head ADD [表单管理人] nvarchar(50) NULL;
END TRY BEGIN CATCH PRINT N'RD_ASM_PROC 加列 表单管理人 跳过'; END CATCH;
GO
BEGIN TRY
IF COL_LENGTH('rd_asm_proc_head', '密级') IS NULL ALTER TABLE rd_asm_proc_head ADD [密级] nvarchar(20) NULL;
END TRY BEGIN CATCH PRINT N'RD_ASM_PROC 加列 密级 跳过'; END CATCH;
GO
BEGIN TRY
IF COL_LENGTH('rd_asm_proc_head', '使用范围') IS NULL ALTER TABLE rd_asm_proc_head ADD [使用范围] nvarchar(100) NULL;
END TRY BEGIN CATCH PRINT N'RD_ASM_PROC 加列 使用范围 跳过'; END CATCH;
GO
BEGIN TRY
IF COL_LENGTH('rd_asm_proc_head', '版本号') IS NULL ALTER TABLE rd_asm_proc_head ADD [版本号] nvarchar(20) NULL;
END TRY BEGIN CATCH PRINT N'RD_ASM_PROC 加列 版本号 跳过'; END CATCH;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 2. [表区] 由 header 改挂 detail,字典扩为 3 值(与前端 filterVal 一一对应)
--    ⚠ 不能「新增一条 detail 表区」—— 同一面板内 label 不得重复
--      (测试断言③ + PanelRegistry.byLabel 只取首个),必须改挂同一行。
-- ═══════════════════════════════════════════════════════════════════
UPDATE yj_field
   SET place = N'detail',
       seq = 4,
       hidden = 0,
       width = 90,
       dict_sql = N'SELECT v FROM (VALUES (N''修订记录''),(N''物料清单''),(N''关键控制清单'')) AS t(v)'
 WHERE panel_code = N'RD_ASM_PROC' AND col_name = N'表区' AND place = N'header';
GO

-- ═══════════════════════════════════════════════════════════════════
-- 3. 新增 header 字段(产品整体尺寸 参照 + 信息栏 4 格)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.ref_panel, v.ref_field, v.display_field, v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  ('RD_ASM_PROC', N'产品整体尺寸', N'产品整体尺寸', N'参照', N'RD_PROD_INFO', N'产品整体尺寸', N'产品整体尺寸', N'header', 38, 180, 1, 0, 0, 1),
  ('RD_ASM_PROC', N'表单管理人',   N'表单管理人',   N'文本', NULL,          NULL,           NULL,           N'header', 92, 120, 1, 0, 0, 1),
  ('RD_ASM_PROC', N'密级',         N'密级',         N'文本', NULL,          NULL,           NULL,           N'header', 94, 100, 1, 0, 0, 1),
  ('RD_ASM_PROC', N'使用范围',     N'使用范围',     N'文本', NULL,          NULL,           NULL,           N'header', 96, 150, 1, 0, 0, 1),
  ('RD_ASM_PROC', N'版本号',       N'版本号',       N'文本', NULL,          NULL,           NULL,           N'header', 98, 100, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                   WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- ═══════════════════════════════════════════════════════════════════
-- 4. 显示层改名(alias)+ 退出编辑面板的 5 个字段(visible=0,列与数据保留)
--    alias 只在 RD_ASM_PROC 上设置 ⇒ 组装BOM表面板仍显「物料名」,两面板各自贴合各自的设计源。
-- ═══════════════════════════════════════════════════════════════════
UPDATE yj_field SET alias = N'物料名称'
 WHERE panel_code = N'RD_ASM_PROC' AND col_name = N'物料名' AND place = N'detail';
GO
UPDATE yj_field SET visible = 0
 WHERE panel_code = N'RD_ASM_PROC' AND place = N'header'
   AND col_name IN (N'产品名称', N'产品种类', N'整体规格外径', N'整体规格长度', N'成品重量');
GO

-- ═══════════════════════════════════════════════════════════════════
-- 5. 校验:明细表区字段 + header 新字段
-- ═══════════════════════════════════════════════════════════════════
SELECT place, seq, col_name, label, ISNULL(alias, N'') AS alias, data_type,
       ISNULL(ref_panel, N'') AS ref_panel, visible,
       CASE WHEN dict_sql IS NULL THEN N'' ELSE N'<有字典>' END AS dict
FROM yj_field
WHERE panel_code = N'RD_ASM_PROC'
ORDER BY place, seq;
GO
SELECT c.name AS 列名 FROM sys.columns c
WHERE c.object_id = OBJECT_ID('rd_asm_proc_head')
  AND c.name IN (N'产品整体尺寸', N'表单管理人', N'密级', N'使用范围', N'版本号');
GO

PRINT N'migrate-asm-proc-redesign-2026-09-20.sql 完成:3 页签结构(修订记录/组装BOM表/组装工艺清单)';
GO
