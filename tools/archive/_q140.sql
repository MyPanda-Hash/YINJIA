SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.qc_return_detail') ORDER BY c.column_id;
SELECT col_name, place, seq FROM yj_field WHERE panel_code='QC_RETURN' ORDER BY seq;
