SET NOCOUNT ON;
PRINT '== 当前 QC_RECV 字段(按 seq 前 28) ==';
SELECT TOP 28 seq, col_name, place, hidden, visible FROM yj_field WHERE panel_code='QC_RECV' ORDER BY seq;
GO
