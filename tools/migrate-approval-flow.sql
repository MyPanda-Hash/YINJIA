/* 审批流迁移(照搬 light-mes 审批逻辑):
   1) yj_form_approval 审批记录表(提交/通过/驳回/弃审全留痕,结构对齐 light-mes form_approval)
   2) yj_doc_status 增加 审批中 标记(pending/pending_by/pending_at) */
USE HSDZ_MES;
SET NOCOUNT ON;
GO
IF OBJECT_ID('yj_form_approval') IS NOT NULL DROP TABLE yj_form_approval;
CREATE TABLE yj_form_approval (
    id          int IDENTITY(1,1) PRIMARY KEY,
    panel_code  nvarchar(40)  NOT NULL,
    form_no     nvarchar(60)  NOT NULL,
    action      nvarchar(20)  NOT NULL,     -- SUBMIT / APPROVE / REJECT / UNAUDIT
    result      nvarchar(10)  NULL,         -- PENDING / APPROVED / REJECTED
    node_no     int           NOT NULL CONSTRAINT df_yjfa_node DEFAULT (1),  -- 审批节点(预留多级)
    operator    nvarchar(40)  NULL,
    opinion     nvarchar(max) NULL,
    create_time datetime2(3)  NOT NULL CONSTRAINT df_yjfa_time DEFAULT (SYSDATETIME())
);
CREATE INDEX ix_yjfa_doc ON yj_form_approval (panel_code, form_no, id);
GO
IF COL_LENGTH('yj_doc_status', 'pending') IS NULL
    ALTER TABLE yj_doc_status ADD
        pending     char(1)      NULL CONSTRAINT df_yjd_pending DEFAULT ('N'),  -- Y=审批中
        pending_by  nvarchar(40) NULL,
        pending_at  datetime2(3) NULL;
GO
UPDATE yj_doc_status SET pending = 'N' WHERE pending IS NULL;
GO
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_form_approval TO yinjia;
GO
DECLARE @c int = (SELECT COUNT(*) FROM yj_form_approval);
PRINT N'审批流迁移完成: yj_form_approval 就绪(行数 ' + CAST(@c AS nvarchar(10)) + N'), yj_doc_status 已加审批中标记';
GO
