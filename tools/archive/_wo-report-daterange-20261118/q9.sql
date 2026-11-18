SET NOCOUNT ON;
SELECT panel_code, panel_name, category, mode, line_table, head_table, group_col, date_col, page_size, config
FROM yj_panel WHERE panel_code='WO_REPORT_LIST';
GO
SELECT COUNT(*) AS t_all FROM scjl;
SELECT COUNT(*) AS t_nodel FROM scjl WHERE ISNULL(delmark,0)=0;
SELECT COUNT(*) AS t_del0_comm FROM scjl WHERE ISNULL(delmark,0)=0 AND ISNULL(comm,'N')<>'Y';
GO
