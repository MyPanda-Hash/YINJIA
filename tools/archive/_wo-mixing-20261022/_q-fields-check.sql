SET NOCOUNT ON;
SELECT seq, col_name, label, label_en, data_type, place, width, visible, editable, hidden
FROM dbo.yj_field WHERE panel_code='WO_MIXING_LIST' ORDER BY seq;
SELECT role_id, perms, can_approve FROM dbo.yj_role_panel WHERE panel_code='WO_MIXING_LIST' ORDER BY role_id;
SELECT scope, ref_key, locale, text FROM dbo.yj_translation WHERE (scope='panel' AND ref_key=N'混料记录') OR (scope='field' AND ref_key IN (N'工单号',N'混料数量',N'物料名称')) ORDER BY scope, ref_key, locale;
