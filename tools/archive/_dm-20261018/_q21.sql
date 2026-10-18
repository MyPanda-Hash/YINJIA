SET NOCOUNT ON;
DELETE FROM yj_field WHERE panel_code='FIELDMGR';
SELECT COUNT(*) AS 剩余字段 FROM yj_field WHERE panel_code='FIELDMGR';
SELECT panel_code, code_col FROM yj_panel WHERE panel_code='FIELDMGR';
