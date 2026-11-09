SET NOCOUNT ON;
SELECT DB_NAME() db, COUNT(*) n FROM rd_equip_use_head;
GO
SELECT 单据编号, asp_cancel, 设备名称 FROM rd_equip_use_head ORDER BY id;
GO
