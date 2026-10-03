SET NOCOUNT ON;
SELECT N'1-USERS' AS seg, username, real_name, ISNULL(is_admin,'') AS is_admin, CAST(role_id AS varchar(20)) AS role_id
FROM yj_user ORDER BY username;
SELECT N'2-ROLES' AS seg, CAST(id AS varchar(20)) AS id, role_name FROM yj_role;
SELECT N'3-TCIN-PERM' AS seg, r.role_name, rp.panel_code, rp.can_approve
FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id WHERE rp.panel_code = 'QC_TC_IN';
SELECT N'4-TCIN-FIELDS' AS seg, col_name, label, data_type, place, CAST(seq AS varchar(10)) AS seq,
       CAST(editable AS varchar(5)) AS editable, CAST(hidden AS varchar(5)) AS hidden
FROM yj_field WHERE panel_code = 'QC_TC_IN' ORDER BY place, seq;
SELECT N'5-TCIN-DOCSTATUS' AS seg, doc_no, ISNULL(pending,'') AS pending, ISNULL(shr,'') AS shr,
       CAST(approve_node AS varchar(10)) AS approve_node, ISNULL(l2_approver,'') AS l2_approver
FROM yj_doc_status WHERE panel_code = 'QC_TC_IN' ORDER BY id DESC;
SELECT N'6-TCIN-ROWS' AS seg, 单据编号, 单据日期, 编制人, 审核人, 审核时间, 审批人, 审批时间, 单据状态
FROM qc_tc_in ORDER BY id DESC;
