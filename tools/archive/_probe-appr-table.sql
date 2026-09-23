USE HSDZ_MES; SET NOCOUNT ON;
SELECT panel_code, panel_name, mode, line_table, head_table, group_col, code_col, prefix, doc=date_col FROM yj_panel WHERE panel_code = N'RD_APPROVAL';
GO
SELECT N'rd_approval' AS t, COUNT(*) AS 列数 FROM sys.columns WHERE object_id=OBJECT_ID('rd_approval')
UNION ALL SELECT N'rd_approval_head', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('rd_approval_head')
UNION ALL SELECT N'rd_approval_detail', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('rd_approval_detail');
GO