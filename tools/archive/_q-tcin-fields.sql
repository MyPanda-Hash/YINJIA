SET NOCOUNT ON;
SELECT N'1-FIELDS-APPROVER' AS seg, panel_code, col_name, label, data_type, place, CAST(editable AS varchar(5)) AS editable
FROM yj_field WHERE col_name IN (N'审批人', N'审批时间') ORDER BY panel_code;
SELECT N'2-QC-TCIN-TABLE-COLS' AS seg, c.name AS col, t.name AS typ, CAST(c.max_length AS varchar(10)) AS len, CAST(c.is_nullable AS varchar(5)) AS nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('qc_tc_in') ORDER BY c.column_id;
SELECT N'3-ROLE-PANEL-ACTIONS-TCIN' AS seg, rp.role_id, rp.panel_code, rp.perms, rp.can_approve
FROM yj_role_panel rp WHERE rp.panel_code = 'QC_TC_IN';
