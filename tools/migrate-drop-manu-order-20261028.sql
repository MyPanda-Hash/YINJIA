-- migrate-drop-manu-order-20261028.sql — 下架「生产加工单 MANU_ORDER」整套遗留实现
--
-- 【用户口径】2026-10-28:「当前这个生产加工单应该不再被使用,当前的内容应该都在生产工单内进行处理实现…
--   进行修改后去除掉」。生产工单现役载体 = plang + 页面 WORK_ORDER_LIST(2026-09-26 数据源单轨);
--   旧 MANU_ORDER 面板(bd_manu_order/bl_manu_order)两账套均 0 行、菜单早已摘除。
--
-- 【本脚本删什么】
--   ① 关联数据:yj_doc_status / form_flow_link / yj_attachment / yj_doc_annotation /
--      report_column_settings / yj_doc_modify_log / yj_form_approval / yj_plan_term 中
--      panel_code 属于 MANU_ORDER / MANU_SCHEDULE 的行(0 行预期,按表存在则删);
--   ② 翻译:yj_translation(scope='panel')里这两个面板名 + 历史名(生产加工单/明细表/统计表/生产排产);
--   ③ 授权:yj_role_panel 两面板行;④ 字段:yj_field 两面板行;⑤ 面板:yj_panel 两面板行;
--   ⑥ 视图 v_manu_schedule(读 bd/bl_manu_order 的旧排产看板,MUST 先于删表);
--   ⑦ 物理表 bd_manu_order / bl_manu_order(默认删;表内必须 0 行,否则整脚本中止)。
--   ⚠ MANU_SCHEDULE(生产排产)是同一条旧链的看板:视图只读这对表 ⇒ 一并下架。
--   ⚠ 不动:wo_order / wo_progress(那是「生产工单(旧版)」WO_ORDER,另一套遗留,本批不清);
--     yj_usage_log / s_allno 为审计流水与号池历史,保留。
--
-- 【幂等】全部按 OBJECT_ID / EXISTS 判空;重复执行 = 0 行、无报错。
-- 【闸门】① 两张表必须 0 行(有任何业务数据整脚本不删,只打印并 RETURN);
--   ② 删表前扫 sys.sql_expression_dependencies,若还有本脚本之外的视图/过程引用两张表 → 中止;
--   ③ 收尾自检(面板/字段/授权/视图/表/译名全 0),不过则 ROLLBACK + THROW。
-- 【迁移链纪律】不要改 tools/_doc_part1_tables.sql / _doc_part2_meta.sql 的字节(它们已登记在
--   db-migrations.txt,改字节会触发整脚本重跑并把旧面板/表重新建回来)。本脚本排在其后:
--   全新库按序重放 = 先建后删,终态正确。
-- 【回滚】本脚本无自动回滚(元数据删除不可逆)。要恢复:还原执行前 .bak,或临时重放
--   _doc_part1_tables.sql + _doc_part2_meta.sql 重建面板/表(0 行,无业务数据可丢)。
-- 【执行】两账套各跑一遍(先 HSDZ_MES 后 HSDZ_MES_TEST):
--   cd tools && YINJIA_SQL_DB=HSDZ_MES java -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-manu-order-20261028.sql
--   cd tools && YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-manu-order-20261028.sql

SET NOCOUNT ON;
SET XACT_ABORT ON;

-- ============ 0. 开关与闸门 ============
DECLARE @DROP_TABLES bit = 1;   -- 0 = 只下架面板元数据、保留两张 0 行物理表(回滚更省事)

DECLARE @rows INT = 0;
IF OBJECT_ID(N'dbo.bd_manu_order', N'U') IS NOT NULL
    SELECT @rows = @rows + COUNT(*) FROM dbo.bd_manu_order;
IF OBJECT_ID(N'dbo.bl_manu_order', N'U') IS NOT NULL
    SELECT @rows = @rows + COUNT(*) FROM dbo.bl_manu_order;
IF @rows > 0
BEGIN
    PRINT N'[ABORT] bd_manu_order/bl_manu_order 仍有数据(' + CAST(@rows AS nvarchar(20)) + N' 行),不执行删除。';
    RETURN;
END

-- 其它面板还以旧面板作「参照字段」的数量:不阻断,只提示(这些参照弹窗会变空,需改指 plang 下拉)
DECLARE @danglingRefs INT = 0;
IF COL_LENGTH(N'dbo.yj_field', N'ref_panel') IS NOT NULL
    SELECT @danglingRefs = COUNT(*) FROM dbo.yj_field
     WHERE ref_panel IN (N'MANU_ORDER', N'MANU_SCHEDULE')
       AND panel_code NOT IN (N'MANU_ORDER', N'MANU_SCHEDULE');

IF @DROP_TABLES = 1
BEGIN
    DECLARE @dep nvarchar(300) = NULL;
    SELECT TOP 1 @dep = OBJECT_NAME(d.referencing_id)
      FROM sys.sql_expression_dependencies d
     WHERE d.referenced_id IN (OBJECT_ID(N'dbo.bd_manu_order'), OBJECT_ID(N'dbo.bl_manu_order'))
       AND OBJECT_NAME(d.referencing_id) NOT IN (N'v_manu_schedule');
    IF @dep IS NOT NULL
    BEGIN
        PRINT N'[ABORT] 仍有对象引用旧表:' + @dep + N' —— 请先处理它再重跑。';
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM sys.foreign_keys
                WHERE referenced_object_id IN (OBJECT_ID(N'dbo.bd_manu_order'), OBJECT_ID(N'dbo.bl_manu_order')))
    BEGIN
        PRINT N'[ABORT] 仍有外键引用 bd_manu_order/bl_manu_order —— 请先处理外键再重跑。';
        RETURN;
    END
END

BEGIN TRANSACTION;

-- ============ 1. 关联数据(按表存在则删) ============
IF OBJECT_ID(N'dbo.yj_doc_status', N'U') IS NOT NULL
    DELETE FROM dbo.yj_doc_status WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE');

IF OBJECT_ID(N'dbo.form_flow_link', N'U') IS NOT NULL
    DELETE FROM dbo.form_flow_link
     WHERE source_panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE')
        OR target_panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE');

IF OBJECT_ID(N'dbo.yj_attachment', N'U') IS NOT NULL
    DELETE FROM dbo.yj_attachment WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE');

IF OBJECT_ID(N'dbo.yj_doc_annotation', N'U') IS NOT NULL
    DELETE FROM dbo.yj_doc_annotation WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE');

IF OBJECT_ID(N'dbo.report_column_settings', N'U') IS NOT NULL
    DELETE FROM dbo.report_column_settings WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE');

IF OBJECT_ID(N'dbo.yj_doc_modify_log', N'U') IS NOT NULL
    DELETE FROM dbo.yj_doc_modify_log WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE');

IF OBJECT_ID(N'dbo.yj_form_approval', N'U') IS NOT NULL
    DELETE FROM dbo.yj_form_approval WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE');

IF OBJECT_ID(N'dbo.yj_plan_term', N'U') IS NOT NULL
    DELETE FROM dbo.yj_plan_term WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE');

-- ============ 2. 面板译名(先按现名取,再兜历史名) ============
IF OBJECT_ID(N'dbo.yj_translation', N'U') IS NOT NULL
    DELETE t FROM dbo.yj_translation t
     WHERE t.scope = N'panel'
       AND (t.ref_key IN (SELECT p.panel_name FROM dbo.yj_panel p
                           WHERE p.panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE'))
            OR t.ref_key IN (N'生产加工单', N'生产加工单明细表', N'生产加工单统计表', N'生产排产'));

-- ============ 3. 授权 / 字段 / 面板 ============
IF OBJECT_ID(N'dbo.yj_role_panel', N'U') IS NOT NULL
    DELETE FROM dbo.yj_role_panel WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE');

IF OBJECT_ID(N'dbo.yj_field', N'U') IS NOT NULL
    DELETE FROM dbo.yj_field WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE');

IF OBJECT_ID(N'dbo.yj_panel', N'U') IS NOT NULL
    DELETE FROM dbo.yj_panel WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE');

-- ============ 4. 视图与物理表 ============
IF OBJECT_ID(N'dbo.v_manu_schedule', N'V') IS NOT NULL
    DROP VIEW dbo.v_manu_schedule;

IF @DROP_TABLES = 1
BEGIN
    IF OBJECT_ID(N'dbo.bl_manu_order', N'U') IS NOT NULL DROP TABLE dbo.bl_manu_order;
    IF OBJECT_ID(N'dbo.bd_manu_order', N'U') IS NOT NULL DROP TABLE dbo.bd_manu_order;
END

-- ============ 5. 收尾自检 ============
IF EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE'))
   OR EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE'))
   OR EXISTS (SELECT 1 FROM dbo.yj_role_panel WHERE panel_code IN (N'MANU_ORDER', N'MANU_SCHEDULE'))
   OR OBJECT_ID(N'dbo.v_manu_schedule', N'V') IS NOT NULL
   OR (@DROP_TABLES = 1 AND (OBJECT_ID(N'dbo.bd_manu_order', N'U') IS NOT NULL
                          OR OBJECT_ID(N'dbo.bl_manu_order', N'U') IS NOT NULL))
BEGIN
    ROLLBACK TRANSACTION;
    ;THROW 50001, N'[FAIL] 生产加工单下架自检未通过:仍有残留对象,已回滚', 1;
END

COMMIT TRANSACTION;
PRINT N'[OK] 生产加工单 MANU_ORDER 已下架(含 MANU_SCHEDULE / v_manu_schedule'
      + CASE WHEN @DROP_TABLES = 1 THEN N' / bd_manu_order / bl_manu_order)' ELSE N',物理表保留)' END;
IF @danglingRefs > 0
    PRINT N'[WARN] 仍有 ' + CAST(@danglingRefs AS nvarchar(10))
        + N' 个其它面板字段把旧面板当参照(ref_panel=MANU_ORDER/MANU_SCHEDULE):参照弹窗将为空,请改指 plang 下拉。';
