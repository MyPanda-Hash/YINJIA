SET NOCOUNT ON;
SELECT h.单据编号, h.检验员, h.总结论, h.批次号, dt.物料编码, dt.物料名称, dt.送检数量, dt.合格数量, dt.不良数量, dt.不合格数量, dt.结案, dt.处置方式, ISNULL(dt.asp_cancel,'N') c
FROM qc_insp h JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号
WHERE h.单据编号 IN ('IJ-2026-09-0152','IJ-2026-10-0001','IJ-2026-10-0200') ORDER BY h.单据编号,dt.id;
GO
SELECT u.username, u.real_name, u.role_id, r.role_name FROM yj_user u LEFT JOIN yj_role r ON r.id=u.role_id WHERE u.username IN ('fengmin','fm','admin');
GO
SELECT rp.role_id, rp.panel_code, rp.can_approve, rp.can_view, rp.can_edit FROM yj_role_panel rp WHERE rp.panel_code='QC_INSP' AND rp.role_id IN (1,1025,1039);
