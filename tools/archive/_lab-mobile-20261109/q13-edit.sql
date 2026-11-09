SET NOCOUNT ON;
SELECT 单据编号, 备注, 手机照片 FROM rd_equip_use_head WHERE 单据编号 = N'EU-2026-11-0002';
GO
SELECT id, 单据编号, 使用日期, 测试项目, 使用人, asp_cancel FROM rd_equip_use_detail WHERE 单据编号 = N'EU-2026-11-0002' ORDER BY id;
GO
SELECT COUNT(*) rows_all FROM rd_equip_use_detail WHERE 单据编号 = N'EU-2026-11-0002';
GO
