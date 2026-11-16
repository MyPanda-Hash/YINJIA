SET NOCOUNT ON;
IF DB_NAME() <> N'HSDZ_MES_TEST'
  RAISERROR(N'[FAIL] 本清理脚本只允许在测试账套 HSDZ_MES_TEST 执行', 16, 1);
DECLARE @no nvarchar(60) = N'SJ-2026-11-0008';
PRINT N'== 清理手工取证单据 ' + @no + N' ==';
SELECT 单据编号, 工单号 FROM qc_first_insp_head WHERE 单据编号=@no;
DELETE FROM dbo.qc_first_insp_detail WHERE 单据编号=@no;
PRINT N'  detail 已删: ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.qc_first_insp_head WHERE 单据编号=@no;
PRINT N'  head 已删: ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.yj_doc_status WHERE panel_code=N'QC_FIRST_INSP' AND doc_no=@no;
PRINT N'  yj_doc_status 已删: ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.form_flow_link WHERE target_form_no=@no OR source_form_no=@no;
PRINT N'  form_flow_link 已删: ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.yj_usage_log WHERE doc_no=@no;
PRINT N'  yj_usage_log 已删: ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.yj_attachment WHERE doc_no=@no;
PRINT N'  yj_attachment 已删: ' + CAST(@@ROWCOUNT AS nvarchar(10));
SELECT COUNT(*) AS remain_head FROM qc_first_insp_head WHERE 单据编号=@no;
