SET NOCOUNT ON;
SELECT panel_code, col_name, label, place, seq, data_type, ref_panel, ref_field, display_field, hidden, visible FROM yj_field WHERE panel_code='DEPT' ORDER BY seq;
GO
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_dept') ORDER BY column_id;
GO
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.yj_dept') ORDER BY column_id;
GO
