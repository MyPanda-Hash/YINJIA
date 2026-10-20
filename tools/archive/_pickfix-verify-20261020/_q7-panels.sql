SET NOCOUNT ON;
SELECT panel_code, panel_name, head_table, line_table, mode FROM yj_panel
 WHERE head_table LIKE N'%outh%' OR line_table LIKE N'%outh%' OR head_table LIKE N'%inh%'
    OR head_table LIKE N'%v_stock%' OR line_table LIKE N'%v_stock%'
 ORDER BY panel_code;
