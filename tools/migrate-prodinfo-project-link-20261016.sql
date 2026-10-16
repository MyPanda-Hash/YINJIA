/* ============================================================================
   项目管理 ↔ 产品信息表 关联(1/N):产品信息表加「立项文档编号」

   用户口径(2026-10-16):
     「现在项目管理的三张面板和产品文件的产品信息表没有关联到一起……因为是先立项申请通过之后
      觉得这个产品有开发的必要才会在产品信息表开始填写对应要开发的产品的数据然后继续下面的流程」
     「一个立项申请的流程可以开发好几个产品,但是产品编号不能相同」

   关联键 = **立项申请的「文档编号」**(项目唯一键,必填;实施计划 RD_PLAN.文档编号 也参照它,
   项目进度查询每行的 [项目编号]/[说明] 里存的正是这个值 —— 见 ButtonService.syncPlanToProgress)。
   本脚本给产品信息表加一格「立项文档编号」把它指回项目;一个项目 → 多张产品信息表(多产品),
   产品编号之间靠 saveDoc 的唯一性校验挡住重号。

   改动:
     ① rd_prod_info_head 加物理列 [立项文档编号] nvarchar(60) NULL + 中文注明;
     ② yj_field 登记该字段(header / seq 36,紧跟 产品编号);参照面板 RD_APPROVAL.文档编号;
     ③ 多语言:yj_translation(scope='field') 补 en(其余语言由机翻兜底)。

   幂等:列用 COL_LENGTH 判存在;字段行按 (panel_code,label,col_name,place) 判存在;
        译名按 (scope,ref_key,locale) 判存在。末尾自检,不过就 RAISERROR(整段事务内)。
   两账套均执行(先正式、后测试)。
   ============================================================================ */

SET NOCOUNT ON;
PRINT '=== 产品信息表:加「立项文档编号」关联字段 ===';

IF OBJECT_ID(N'dbo.rd_prod_info_head', N'U') IS NULL
BEGIN
    RAISERROR(N'rd_prod_info_head 不存在,跳过', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

/* ① 物理列 + 中文注明 */
IF COL_LENGTH(N'dbo.rd_prod_info_head', N'立项文档编号') IS NULL
BEGIN
    ALTER TABLE dbo.rd_prod_info_head ADD [立项文档编号] nvarchar(60) NULL;
    PRINT '已加列 rd_prod_info_head.立项文档编号';
END
ELSE PRINT '列 rd_prod_info_head.立项文档编号 已存在';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.rd_prod_info_head') AND minor_id = 0
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品信息表(研发:产品要开发的数据)',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_prod_info_head';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.rd_prod_info_head')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.rd_prod_info_head'), N'立项文档编号', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'所属立项申请的文档编号(项目唯一键):一张产品信息表对应一次立项;一个立项可开发多个产品(产品编号各不相同)',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_prod_info_head', N'COLUMN', N'立项文档编号';

/* ② yj_field 登记 */
IF NOT EXISTS (SELECT 1 FROM yj_field
               WHERE panel_code = N'RD_PROD_INFO' AND label = N'立项文档编号'
                 AND col_name = N'立项文档编号' AND place = N'header')
BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible)
    VALUES (N'RD_PROD_INFO', N'立项文档编号', N'立项文档编号', N'文本', 'RD_APPROVAL', N'文档编号', N'文档编号',
            N'header', 36, 180, 1, 0, 0, 1);
    PRINT '已登记 yj_field:RD_PROD_INFO.立项文档编号';
END
ELSE PRINT 'yj_field 已登记 RD_PROD_INFO.立项文档编号';

/* ③ 多语言(至少 en;zh-CN 为 key=text 桩不需要) */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'立项文档编号' AND locale = 'en')
BEGIN
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'立项文档编号', 'en', N'Project Document No.', 'manual');
    PRINT '已加译名 en';
END
ELSE PRINT '译名 en 已存在';

-- 自检:列在 + 字段在 + 译名在
IF COL_LENGTH(N'dbo.rd_prod_info_head', N'立项文档编号') IS NULL
   OR (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'RD_PROD_INFO' AND label = N'立项文档编号') < 1
   OR (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'立项文档编号' AND locale = 'en') < 1
BEGIN
    ROLLBACK TRANSACTION;
    RAISERROR(N'自检失败:列/字段/译名 未全部就位', 16, 1);
    RETURN;
END
COMMIT TRANSACTION;
PRINT '自检通过:立项文档编号 列 + yj_field + en 译名 就位';
PRINT '=== 完成 ===';
