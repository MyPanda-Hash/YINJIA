-- migrate-line-open-drop.sql — 开线管理整体下线(2026-09-24 用户拍板)
-- 背景:工单排产看板(WorkOrderBoard)左侧骨架的 开线/未开线 标签与切换为临时试做功能,
--   用户 2026-09-24 拍板去除——看板不再区分是否开线,只做 按线查看+调线。
-- 联动:前端 toggleOpen/开线列 已删,/px/scheduleBoard/setOpen 端点与 linesSummary.开线 字段已删。
-- 本脚本:DROP bs_line_open(由 migrate-line-shift-open.sql 创建,该脚本在链中保持原样不回改——
--   新库场景=先建后删,幂等安全);表内仅当日开线探针/试用痕迹,无业务数据。
SET NOCOUNT ON;

IF OBJECT_ID('bs_line_open') IS NOT NULL DROP TABLE bs_line_open;

SELECT N'bs_line_open 残留' AS 检查, COUNT(*) AS n FROM sys.tables WHERE name = 'bs_line_open';
PRINT N'migrate-line-open-drop 完成';
GO
