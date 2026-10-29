/* ============================================================================
   rollback-prod-pick-outh-20261022.sql —— 只撤掉「生产领料（PROD_PICK_LIST）」这套元数据
   删什么：包装视图 v_prod_pick_list、面板行 yj_panel、字段 yj_field、角色授权 yj_role_panel、
           面板名译名（scope='panel' 的「生产领料」）。
   不删什么：dbo.outh（源表，一个字节都不动）、字段名译名（单据编号/批号 等是全库共享词条，
            别的面板也在用，删了会连带影响）、任何其它面板。
   幂等：可重复执行。两个账套都要跑（各自回滚自己那份）。
   执行：DbSync run rollback-prod-pick-outh-20261022.sql
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @panel sysname = N'PROD_PICK_LIST';
DECLARE @panelName nvarchar(120) = N'生产领料';

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.v_prod_pick_list', N'V') IS NOT NULL
        DROP VIEW dbo.v_prod_pick_list;

    DELETE FROM dbo.yj_field       WHERE panel_code = @panel;
    DELETE FROM dbo.yj_role_panel  WHERE panel_code = @panel;
    DELETE FROM dbo.yj_panel       WHERE panel_code = @panel;
    DELETE FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = @panelName;

    -- 收尾守卫：面板痕迹必须清零（视图允许不存在）
    IF EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = @panel)
        THROW 51000, N'回滚失败：yj_panel 仍有本面板行。', 1;
    IF EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = @panel)
        THROW 51000, N'回滚失败：yj_field 仍有本面板字段。', 1;
    IF EXISTS (SELECT 1 FROM dbo.yj_role_panel WHERE panel_code = @panel)
        THROW 51000, N'回滚失败：yj_role_panel 仍有本面板授权。', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT N'RESULT: PROD_PICK_LIST-ROLLED-BACK' AS 结果;
