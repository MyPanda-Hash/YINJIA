-- migrate-rd-cleanup.sql — 清理研发三面板数据(项目申请表/项目实施计划/项目进度查询)并归零号池
-- 清理范围: 单据头/行 + 单据状态 + 修改记录 + 审批记录 + 使用日志 + 单据流链接;号池重置便于测试编号从 0001 起
SET NOCOUNT ON;
-- ① 使用日志(按单据编号;先删,后面单据就查不到了)
DELETE FROM yj_usage_log WHERE doc_no IN (
  SELECT [单据编号] FROM rd_approval
  UNION SELECT [单据编号] FROM rd_plan
  UNION SELECT [单据编号] FROM rd_progress
);
-- ② 修改记录 / 审批记录 / 单据流链接 / 单据状态
DELETE FROM yj_doc_modify_log WHERE panel_code IN ('RD_APPROVAL','RD_PLAN','RD_PROGRESS');
DELETE FROM yj_form_approval  WHERE panel_code IN ('RD_APPROVAL','RD_PLAN','RD_PROGRESS');
DELETE FROM form_flow_link    WHERE source_panel_code IN ('RD_APPROVAL','RD_PLAN','RD_PROGRESS')
                                 OR target_panel_code IN ('RD_APPROVAL','RD_PLAN','RD_PROGRESS');
DELETE FROM yj_doc_status     WHERE panel_code IN ('RD_APPROVAL','RD_PLAN','RD_PROGRESS');
GO
-- ③ 业务数据(行→头)
DELETE FROM rd_progress_detail;
DELETE FROM rd_progress;
DELETE FROM rd_plan_detail;
DELETE FROM rd_plan;
DELETE FROM rd_approval_detail;
DELETE FROM rd_approval;
GO
-- ④ 号池归零(LXA/LXB/LXJ:换测试编号时重新从 0001 开始;历史格式 260904 一并清)
DELETE FROM s_allno WHERE lb IN ('LXA','LXB','LXJ');
GO
PRINT N'migrate-rd-cleanup 完成(三面板数据清空+号池归零)';
GO
