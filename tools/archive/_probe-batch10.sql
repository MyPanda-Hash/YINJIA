SET NOCOUNT ON;
GO
PRINT '=== 探针遗留的测试暂收单(反序清理:先弃审/作废,再软删) ===';
DECLARE @no nvarchar(40) = N'SL-2026-10-0001';
IF NOT EXISTS (SELECT 1 FROM sl_recv WHERE 单据编号 = @no)
    PRINT N'  该单不存在,无需清理';
ELSE
BEGIN
    UPDATE sl_recv        SET asp_cancel = N'Y', asp_user2 = N'system', asp_time2 = GETDATE() WHERE 单据编号 = @no;
    UPDATE sl_recv_detail SET asp_cancel = N'Y', asp_user2 = N'system', asp_time2 = GETDATE() WHERE 单据编号 = @no;
    UPDATE yj_doc_status  SET canceled = N'Y', update_at = GETDATE() WHERE panel_code = N'QC_RECV' AND doc_no = @no;
    UPDATE form_flow_link SET link_status = N'RELEASED' WHERE target_panel_code = N'QC_RECV' AND target_form_no = @no;
    PRINT N'  已清理 ' + @no;
END
GO
SELECT 单据编号, 批次号, ISNULL(asp_cancel,N'N') AS asp_cancel FROM sl_recv WHERE 单据编号 = N'SL-2026-10-0001';
GO
