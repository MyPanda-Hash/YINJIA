SET NOCOUNT ON;
PRINT N'===== 1. rd_dev_task 全量 =====';
SELECT id, 产品编号, 产品名称, 源单据号, 目标面板, 下发人, 下发时间, 负责人, asp_cancel FROM rd_dev_task ORDER BY id;
GO

SET NOCOUNT ON;
PRINT N'===== 2. rd_dev_task 目标面板 分布式 =====';
SELECT 目标面板, COUNT(*) n FROM rd_dev_task GROUP BY 目标面板;
GO

SET NOCOUNT ON;
PRINT N'===== 3. rd_spec_assign 列 =====';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_spec_assign' ORDER BY ORDINAL_POSITION;
GO
SET NOCOUNT ON;
SELECT COUNT(*) AS rd_spec_assign_rows FROM rd_spec_assign;
GO
SET NOCOUNT ON;
SELECT * FROM rd_spec_assign;
GO

SET NOCOUNT ON;
PRINT N'===== 4. yj_form_approval 列 =====';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_form_approval' ORDER BY ORDINAL_POSITION;
GO
SET NOCOUNT ON;
SELECT COUNT(*) AS yj_form_approval_rows FROM yj_form_approval;
GO
SET NOCOUNT ON;
SELECT * FROM yj_form_approval;
GO

SET NOCOUNT ON;
PRINT N'===== 5. yj_doc_status 列 =====';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_doc_status' ORDER BY ORDINAL_POSITION;
GO
SET NOCOUNT ON;
SELECT COUNT(*) AS yj_doc_status_rows FROM yj_doc_status;
GO
SET NOCOUNT ON;
SELECT TOP 50 * FROM yj_doc_status;
GO

SET NOCOUNT ON;
PRINT N'===== 6. rd_approval / rd_approval_detail 列+行数 =====';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('rd_approval','rd_approval_detail') ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO
SET NOCOUNT ON;
SELECT COUNT(*) AS rd_approval_rows FROM rd_approval;
GO
SET NOCOUNT ON;
SELECT * FROM rd_approval;
GO
