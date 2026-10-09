/* migrate-wo-process-line-drop.sql(2026-10-06):回退预排产 —— 删除工序—产线预排台账
 * 用户口径:「当前的方式我错了,不应该预排产的…不需要进行预排产,将预排产内容回退」。
 * 本脚本只删表(纯新增表,无业务数据损失);代码侧预排钩子/字段/界面同批回退。
 * 幂等可重跑;两账套均执行。
 */
IF OBJECT_ID(N'dbo.wo_process_line', N'U') IS NOT NULL DROP TABLE dbo.wo_process_line;
GO
IF OBJECT_ID(N'dbo.wo_process_line', N'U') IS NULL PRINT N'预排产台账已删除(回退完成)';
GO