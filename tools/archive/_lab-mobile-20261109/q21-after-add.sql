SET NOCOUNT ON;
SELECT id, 单据编号, 测试项目, 使用人, 手机照片, asp_cancel FROM rd_equip_use_detail WHERE 单据编号=N'EU-2026-11-0003' ORDER BY id;
GO
SELECT id, panel_code, doc_no, field_key, file_name FROM yj_attachment WHERE doc_no=N'EU-2026-11-0003' ORDER BY id;
GO
