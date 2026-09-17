SET NOCOUNT ON;
-- 查 YJ-YC 这个供应商在 MES 和沙箱的状态
SELECT N'MES(dm_gf)' AS src, dm, mc FROM dm_gf WHERE dm = 'YJ-YC';
-- 查哪些单据用了这个供应商
SELECT h.单据编号, h.供应商, h.供应商编码, h.ERP单号, h.单据状态 FROM bd_purchase_in h WHERE h.供应商编码 = 'YJ-YC';
