-- migrate-ref-filter.sql — 参照字段"只列已归档"过滤的数据驱动化
--
-- 【为什么要改】现状 PanelConfigService:504 把过滤**硬编码**成单面板:
--     if ("RD_APPROVAL".equals(f.refPanel())) m.put("filter", Map.of("单据状态", "已归档"));
-- 新增参照(RD_PROD_INFO / RD_PROGRESS)需要同样的"只列已归档"口径,继续硬编码就是又一份清单,
-- 与新面板/新字段脱节(与「技术债清单」第 1 条同类问题)。
--
-- 【机制】yj_field 加 ref_filter 列,存过滤条件文本,PanelConfigService.parseRefFilter 解析成 Map。
--   · ref_filter 为 NULL ⇒ 不下发 filter ⇒ **行为与改造前逐字等价**(纯增量,不动任何既有面板表现)
--   · 写成 "单据状态=已归档" ⇒ 该参照只列已归档单据
--   · 多条件用逗号分隔:"k=v,k2=v2"(当前只需单条件,但解析器支持)
--
-- 幂等:COL_LENGTH / 条件 UPDATE,可重复执行。
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ═══ 1. 加列 ═══
BEGIN TRY
IF COL_LENGTH('yj_field', 'ref_filter') IS NULL ALTER TABLE yj_field ADD ref_filter nvarchar(200) NULL;
END TRY BEGIN CATCH PRINT N'yj_field.ref_filter 加列跳过(无 DDL 权限?)'; END CATCH;
GO

-- ═══ 2. 既有 RD_APPROVAL 口径搬进新列(与硬编码等价,行为不变) ═══
UPDATE yj_field SET ref_filter = N'单据状态=已归档'
WHERE ref_panel = N'RD_APPROVAL' AND ref_filter IS NULL;
GO

-- ═══ 3. 本次**新增**参照:只列已归档(白名单式,只碰我们自己加的字段) ═══
--    依据:设计流程图 产品信息表 → 一级审核 → 二级审核 → 任务分发,之后才写下游文件;
--          未归档的产品信息表编号未定稿,被引用会落空(与 RD_APPROVAL 同一理由)。
--
--    ⚠⚠ 这里**必须白名单,不能用 "WHERE ref_panel IN (RD_PROD_INFO, RD_PROGRESS)"**。
--       第一版就是那么写的,结果把**既有**参照字段一起改了(实测命中):
--         RD_MOLD_PROC.产品编号 / RD_ASM_PROC.产品编号 / RD_ASM_BOM.产品编号 /
--         RD_INSP_PLAN.产品编号 / RD_SPEC_DOC.编号   ← 全部改为"只列已归档"
--       后果是功能回退:产品信息表一归档下游才建得出文件,而规格书恰恰是在产品开发中写的
--       —— 加了过滤后**新建规格书选不到在研产品**,整条产品文件流程被堵死。
--       这是本次改动范围之外的行为变更,必须避免。
--
--    白名单 = 本次新增的 4 个跨面"自动填充规格书"字段(见 migrate-rd-2026-design.sql §B/§C/§D)。
UPDATE f SET f.ref_filter = N'单据状态=已归档'
FROM yj_field f
JOIN (VALUES
  ('RD_ASM_PROC',  N'客户项目名称'),
  ('RD_ASM_PROC',  N'产品功能类别'),
  ('RD_INSP_PLAN', N'产品功能类别'),
  ('RD_SPEC_DOC',  N'客户项目名称')
) AS w(panel_code, col_name)
  ON f.panel_code = w.panel_code AND f.col_name = w.col_name
WHERE f.ref_filter IS NULL;
GO

-- ═══ 4. ⚠ 三个参照必须保持"不过滤"(各有理由,都是实测出来的) ═══
--    · RD_PROD_DOCLIST.产品编号 —— 本表跟踪的就是开发中的产品,过滤掉未归档等于没数据
--    · RD_SPEC_DOC.编号      —— 规格书在产品开发中编写,必须能选在研产品(见上方说明)
--    · RD_SAMPLE_NO.项目名称  —— 指向 RD_PROGRESS,而 RD_PROGRESS 是**单单据面板且永远草稿**
--                              (CONTEXT:「无归档、无修改闭环、永远草稿」)⇒ 一旦加"只列已归档"
--                              这个参照**永远为空**,样品编号表直接不可用。
--    显式清空,兼作第一版误改的回滚(幂等)。
UPDATE yj_field SET ref_filter = NULL
WHERE (panel_code = N'RD_PROD_DOCLIST' AND col_name = N'产品编号')
   OR (panel_code = N'RD_SPEC_DOC'     AND col_name = N'编号')
   OR (panel_code = N'RD_SAMPLE_NO'    AND col_name = N'项目名称');
GO

-- ═══ 4b. 第一版误改的其它既有参照一并还原 ═══
--    (RD_MOLD_PROC / RD_ASM_PROC / RD_ASM_BOM / RD_INSP_PLAN 的 产品编号)
UPDATE yj_field SET ref_filter = NULL
WHERE ref_panel = N'RD_PROD_INFO'
  AND col_name IN (N'产品编号')
  AND panel_code <> N'RD_PROD_DOCLIST';
GO

-- ═══ 5. 加中文列注明(AGENTS.md:改动表结构须补注) ═══
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('yj_field') AND minor_id = COLUMNPROPERTY(OBJECT_ID('yj_field'), 'ref_filter', 'ColumnId')
                 AND name = 'MS_Description')
BEGIN
  DECLARE @colid int = COLUMNPROPERTY(OBJECT_ID('yj_field'), 'ref_filter', 'ColumnId');
  EXEC sp_addextendedproperty N'MS_Description',
       N'参照字段过滤条件(如"单据状态=已归档");NULL=不过滤,行为与改造前等价;多条件逗号分隔',
       N'SCHEMA', N'dbo', N'TABLE', N'yj_field', N'COLUMN', N'ref_filter';
END
GO

-- ═══ 6. 核对 ═══
SELECT panel_code, col_name, ref_panel, ISNULL(ref_filter, N'(不过滤)') AS ref_filter
FROM yj_field
WHERE ref_panel IS NOT NULL
ORDER BY panel_code, place, seq;
GO

PRINT N'migrate-ref-filter.sql 完成';
GO
