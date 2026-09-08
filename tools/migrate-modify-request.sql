-- migrate-modify-request.sql — 文件类面板:归档后申请修改(管理员审批) + 修改记录(滚动3条)
-- 状态机:已归档 ─申请修改→ 修改申请中 ─管理员通过→ 修改中(可编辑) ─提交审批→ 审批中 ─通过→ 已归档(+写入修改记录)
-- 幂等:列/表存在性判断,可重复执行
SET NOCOUNT ON;
GO
IF COL_LENGTH('yj_doc_status', 'modify_state') IS NULL
    ALTER TABLE yj_doc_status ADD modify_state char(1) NULL; -- 'R'=修改申请中 'Y'=修改中
GO
IF COL_LENGTH('yj_doc_status', 'modify_req_by') IS NULL
    ALTER TABLE yj_doc_status ADD modify_req_by nvarchar(50) NULL;
GO
IF COL_LENGTH('yj_doc_status', 'modify_req_at') IS NULL
    ALTER TABLE yj_doc_status ADD modify_req_at datetime2 NULL;
GO
IF COL_LENGTH('yj_doc_status', 'modify_appr_by') IS NULL
    ALTER TABLE yj_doc_status ADD modify_appr_by nvarchar(50) NULL;
GO
IF COL_LENGTH('yj_doc_status', 'modify_appr_at') IS NULL
    ALTER TABLE yj_doc_status ADD modify_appr_at datetime2 NULL;
GO
IF OBJECT_ID('yj_doc_modify_log') IS NULL
CREATE TABLE yj_doc_modify_log (
    id bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    panel_code nvarchar(50) NOT NULL,
    doc_no nvarchar(100) NOT NULL,
    apply_by nvarchar(50) NULL,          -- 申请人
    apply_at datetime2 NULL,             -- 申请时间
    approve_by nvarchar(50) NULL,        -- 进入修改态的审批人
    approve_at datetime2 NULL,
    rearchive_by nvarchar(50) NULL,      -- 再归档审批人
    rearchive_at datetime2 NULL,
    snapshot_head nvarchar(max) NULL,    -- 进入修改态时头字段快照(label→值 JSON)
    snapshot_rows nvarchar(max) NULL,    -- 明细行快照(id/hash/label JSON)
    changes nvarchar(max) NULL,          -- 再归档时头字段 diff JSON [{label,kind,old,new}]
    change_meta nvarchar(max) NULL,      -- 明细变化摘要 JSON {addedRows,removedRows,changedRows,samples}
    create_at datetime2 NOT NULL DEFAULT GETDATE()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_doc_modify_log_doc')
    CREATE INDEX ix_doc_modify_log_doc ON yj_doc_modify_log (panel_code, doc_no, id);
GO
PRINT N'修改申请/修改记录迁移完成';
GO
