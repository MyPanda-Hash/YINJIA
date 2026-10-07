SET NOCOUNT ON;
SELECT N'1-APPROVE-ROLES' AS seg, r.role_name, rp.panel_code, rp.can_approve
FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
WHERE rp.can_approve = 'Y' ORDER BY r.role_name, rp.panel_code;
SELECT N'2-QC-PANELS-PERM' AS seg, r.role_name, rp.panel_code, rp.can_approve
FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
WHERE rp.panel_code LIKE 'QC%' ORDER BY rp.panel_code, r.role_name;
SELECT N'3-TRANSLATION-APPROVER' AS seg, scope, ref_key, locale, text
FROM yj_translation WHERE ref_key IN (N'审批人', N'审批时间', N'编制人', N'审核人') ORDER BY ref_key, locale;
SELECT N'4-MSG-CODES' AS seg, 消息码, COUNT(*) AS n FROM yj_message GROUP BY 消息码 ORDER BY 消息码;
