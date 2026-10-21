/* ============================================================================
   rollback-wo-mixing-list.sql —— 撤回「混料记录」面板（幂等，可重复执行）
   只删本功能自己写进去的元数据；**不删** wo_mixing_list / v_wo_mixing_list 源对象数据。
   用法：java -cp lib\mssql-jdbc.jar SqlRunner.java <jdbc:...> yinjia <密码> rollback-wo-mixing-list.sql
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST。', 1;

DECLARE @panel sysname = N'WO_MIXING_LIST';

BEGIN TRY
    BEGIN TRANSACTION;

    DELETE FROM dbo.yj_field       WHERE panel_code = @panel;
    DELETE FROM dbo.yj_role_panel  WHERE panel_code = @panel;
    DELETE FROM dbo.yj_panel       WHERE panel_code = @panel;
    -- ⚠ 只删**面板名**这一条译名；字段译名是全局共享的（同一中文标签别的面板也在用，
    --   见 AGENTS「多语言」规范），删了会把别的面板的英文标题一起抹掉 —— 留着无害。
    DELETE FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'混料记录';

    -- 包装视图（只有源对象没有 id 列时才会建）
    IF OBJECT_ID(N'dbo.v_wo_mixing_list', N'V') IS NOT NULL
        AND OBJECT_ID(N'dbo.wo_mixing_list', N'V') IS NULL
        EXEC(N'DROP VIEW dbo.v_wo_mixing_list;');

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = @panel)
            THEN N'RESULT: ROLLBACK-FAIL（面板仍在）'
            ELSE N'RESULT: ROLLBACK-OK' END AS 结果;
