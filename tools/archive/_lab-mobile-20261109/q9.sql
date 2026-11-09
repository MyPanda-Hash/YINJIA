SET NOCOUNT ON;
SELECT 单据编号, 单据日期, 设备名称, 备注, 手机照片 FROM rd_equip_use_head WHERE 单据编号 = N'EU-2026-11-0003';
GO
SELECT id, panel_code, doc_no, field_key, file_name, file_size, content_type, asp_user1 FROM yj_attachment WHERE doc_no = N'EU-2026-11-0003';
GO
SELECT 单据编号, 使用日期, 测试项目, 使用人 FROM rd_equip_use_detail WHERE 单据编号 = N'EU-2026-11-0003';
GO
