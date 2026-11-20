SET NOCOUNT ON;
SELECT id, menu_code, parent_code, title, seq, hidden FROM yj_menu_node WHERE menu_code IN (N'qcProcInsp',N'qcAsmInsp');
SELECT TOP 5 menu_code, parent_code, title FROM yj_menu_node ORDER BY id;
