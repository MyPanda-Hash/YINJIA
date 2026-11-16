SET NOCOUNT ON;
SELECT TOP 12 单据编号, 单据日期, 供应商, 供应商编码 FROM bd_pu_order ORDER BY id DESC;
GO
SELECT COUNT(*) AS n_head FROM bd_pu_order;
GO
SELECT TOP 5 id, 单据编号, asp_time1 FROM bd_pu_order WHERE 单据编号 LIKE '%202611%' ORDER BY id DESC;
GO
-- 11039 是否存在于任何含 id 的 bl_/bd_ 行表?
SELECT 'bl_pu_order' AS t, COUNT(*) AS n FROM bl_pu_order WHERE id = 11039;
