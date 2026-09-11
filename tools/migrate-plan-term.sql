-- migrate-plan-term.sql — 项目实施计划「申请终止(阶段处)」二级审批状态表
-- 流程:申请终止(阶段N) → P1 待立项人审批 → P2 待管理员审批 → T 已终止(落实:锁定单据);
-- 驳回/撤回删行(可重新申请);历史留痕走 yj_form_approval(TERM_* 动作)。
-- 立项人 = 本计划 文档编号 所引立项申请(rd_approval)的「申请立项人」,按姓名匹配 yj_user.real_name(严格口径,无账号则挂起待其有账号)。
-- 幂等:可重复执行。运行(UTF-8 无 BOM): SqlRunner / sqlcmd -f 65001
USE HSDZ_MES;
SET NOCOUNT ON;
GO
IF OBJECT_ID('yj_plan_term') IS NULL CREATE TABLE yj_plan_term (
    id         int IDENTITY(1,1) PRIMARY KEY,
    panel_code varchar(40)  NOT NULL CONSTRAINT df_ypt_panel DEFAULT ('RD_PLAN'),
    doc_no     nvarchar(60) NOT NULL,
    stage      int          NOT NULL,             -- 终止于阶段N(1~10)
    reason     nvarchar(500) NULL,                -- 终止原因(选填)
    state      char(2)      NOT NULL,             -- P1=待立项人审批 P2=待管理员审批 T=已终止
    req_by     nvarchar(50) NULL, req_at datetime2 NULL,
    p1_by      nvarchar(50) NULL, p1_at datetime2 NULL,  -- 立项人通过(时间即递交管理员)
    p2_by      nvarchar(50) NULL, p2_at datetime2 NULL,  -- 管理员通过(时间即落实终止)
    asp_user1  nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2  nvarchar(50) NULL, asp_time2 datetime2 NULL,
    CONSTRAINT uq_ypt_doc UNIQUE (panel_code, doc_no)
);
GO
PRINT N'yj_plan_term 终止审批表就绪';
GO
