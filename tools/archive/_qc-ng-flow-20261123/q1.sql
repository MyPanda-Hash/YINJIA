SET NOCOUNT ON;
SELECT DB_NAME() AS db;
-- QC_BHC 里由出货检验带过来的单(出货检验单号 ZC-/ZJ-)
SELECT [单据编号],[单据日期],[出货检验单号],[工单号],[产品编码],[不合格品数量],[不合格品比例],asp_cancel
  FROM dbo.qc_bhc
 WHERE ISNULL([出货检验单号],N'') LIKE N'ZC-%' OR ISNULL([出货检验单号],N'') LIKE N'ZJ-%'
 ORDER BY id DESC;
-- 字段元数据:出货检验单号 / 工单号 的参照源
SELECT label, data_type, ref_panel, ref_field, display_field, editable, place
  FROM dbo.yj_field WHERE panel_code = N'QC_BHC' AND label IN (N'出货检验单号', N'工单号');
