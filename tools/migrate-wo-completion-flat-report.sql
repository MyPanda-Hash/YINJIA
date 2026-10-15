/* 完工明细与 WO_REPORT_LIST 使用同一报表呈现契约。
   mode=flat只决定后端取数；前端reportMode由category='报表'判定。
   原category='生产执行'导致flat数据被按cur单据逐张浏览。
   菜单归属由menus.js维护,改报表类别不移动生产执行入口。
   不改scjl/只读视图/字段/权限；幂等，两账套执行。 */
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS(SELECT 1 FROM dbo.yj_panel WHERE panel_code='WO_REPORT_LIST' AND mode='flat')
 THROW 51000,N'缺少flat报工记录面板，请先核实原面板契约',1;
-- 正式库现役报工记录的category为报表；测试库旧快照类别可能陈旧，按现役呈现契约对齐目标。
IF NOT EXISTS(SELECT 1 FROM dbo.yj_panel WHERE panel_code='WO_COMPLETION_LIST' AND line_table=N'v_wo_completion_detail')
 THROW 51000,N'缺少完工明细只读视图面板',1;
UPDATE dbo.yj_panel SET category=N'报表',mode='flat',config=NULL,config_at=NULL
WHERE panel_code='WO_COMPLETION_LIST';
IF @@ROWCOUNT<>1 THROW 51000,N'完工明细面板行数异常',1;
IF EXISTS(SELECT 1 FROM dbo.yj_panel WHERE panel_code='WO_COMPLETION_LIST' AND (category<>N'报表' OR mode<>'flat'))
 THROW 51000,N'完工明细报表模式验证失败',1;
COMMIT;
