SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM sys.extended_properties WHERE class=1 AND major_id=OBJECT_ID('dbo.wo_proc_card_head') AND minor_id>0 AND name='MS_Description') AS head_cols_desc,
       (SELECT COUNT(*) FROM sys.extended_properties WHERE class=1 AND major_id=OBJECT_ID('dbo.wo_proc_card_detail') AND minor_id>0 AND name='MS_Description') AS det_cols_desc,
       (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code='PROC_FLOW_CARD') AS grants,
       (SELECT COUNT(*) FROM yj_translation WHERE ref_key IN (N'工序流程追踪卡',N'录入照片',N'确认完成',N'小批次号',N'大批次号',N'卡号') AND scope IN ('panel','field')) AS trs;
SELECT role_id, panel_code, perms FROM yj_role_panel WHERE panel_code='PROC_FLOW_CARD' ORDER BY role_id;
