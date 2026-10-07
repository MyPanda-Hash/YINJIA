SET NOCOUNT ON;
SELECT N'1-PROD-TCIN-COUNT' AS seg, CAST(COUNT(*) AS varchar(10)) AS n,
       CAST(SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS varchar(10)) AS canceled
FROM qc_tc_in;
SELECT N'2-PROD-TCIN-SIGN' AS seg, 单据编号, ISNULL(编制人,'') AS 编制人, ISNULL(审核人,'') AS 审核人, ISNULL(审批人,'') AS 审批人
FROM qc_tc_in ORDER BY id DESC;
SELECT N'3-PROD-PERM' AS seg, r.role_name, rp.perms, rp.can_approve
FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id WHERE rp.panel_code='QC_TC_IN' ORDER BY r.id;
SELECT N'4-PROD-FIELDS' AS seg, col_name, CAST(editable AS varchar(5)) AS editable
FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name IN (N'编制人',N'审核人',N'审批人',N'审核时间',N'审批时间') ORDER BY seq;
