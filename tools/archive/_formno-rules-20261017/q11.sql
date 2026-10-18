SET NOCOUNT ON;
SELECT panel_code, panel_name, category, mode, ISNULL(prefix,'') AS prefix
FROM yj_panel
WHERE panel_name LIKE N'%报价%' OR panel_name LIKE N'%出货%' OR panel_name LIKE N'%送货%'
   OR panel_name LIKE N'%物流%' OR panel_name LIKE N'%零售%' OR panel_name LIKE N'%请购%'
   OR panel_name LIKE N'%盘点%' OR panel_name LIKE N'%调拨%' OR panel_name LIKE N'%装箱%'
   OR panel_name LIKE N'%模具%' OR panel_name LIKE N'%固定%' OR panel_name LIKE N'%成本%'
   OR panel_name LIKE N'%收款%' OR panel_name LIKE N'%付款%' OR panel_name LIKE N'%预%'
   OR panel_name LIKE N'%报销%' OR panel_name LIKE N'%工时%' OR panel_name LIKE N'%凭证%'
   OR panel_name LIKE N'%会员%' OR panel_name LIKE N'%订舱%' OR panel_name LIKE N'%活动%'
   OR panel_name LIKE N'%线索%' OR panel_name LIKE N'%价目%' OR panel_name LIKE N'%抓阄%'
   OR panel_name LIKE N'%委外%' OR panel_name LIKE N'%移转%' OR panel_name LIKE N'%排产%'
   OR panel_name LIKE N'%领料%' OR panel_name LIKE N'%余料%' OR panel_name LIKE N'%不良%'
   OR panel_name LIKE N'%失效%' OR panel_name LIKE N'%盘点%' OR panel_name LIKE N'%调整单%'
   OR panel_name LIKE N'%结转%' OR panel_name LIKE N'%样品%' OR panel_name LIKE N'%资产%'
ORDER BY category, panel_name;
PRINT '== 已下架/弃用的面板编码(元数据里可能仍留痕) ==';
SELECT panel_code, panel_name FROM yj_panel WHERE panel_code IN (N'PU_REQ',N'SL_RECV',N'QC_RECV',N'WO_ORDER',N'RKD',N'CGD',N'WLBOM');
