-- migrate-archived-at.sql — 文件面板查询单据:首次归档时间列(时间区间过滤口径)
-- archived_at 仅在首次归档时写入(markArchived CASE 保首次),再归档不覆盖;存量行以 update_at 回填
SET NOCOUNT ON;
GO
IF COL_LENGTH('yj_doc_status', 'archived_at') IS NULL
    ALTER TABLE yj_doc_status ADD archived_at datetime2 NULL;
GO
UPDATE yj_doc_status SET archived_at = update_at
WHERE archived_at IS NULL AND ISNULL(archived, 'N') = 'Y';
GO
PRINT N'archived_at 迁移完成';
GO
