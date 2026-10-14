SET NOCOUNT ON;
DECLARE @doc nvarchar(50) = N'CPJY-2026-10-0001';
DELETE FROM dbo.qc_fin_spec_detail WHERE 单据编号 = @doc;
DELETE FROM dbo.qc_fin_spec_head   WHERE 单据编号 = @doc;
DELETE FROM dbo.yj_doc_status      WHERE panel_code = N'QC_FIN_SPEC' AND doc_no = @doc;
PRINT N'  示例单 CPJY-2026-10-0001 已清(头/行/单据状态),等待脚本重播';
