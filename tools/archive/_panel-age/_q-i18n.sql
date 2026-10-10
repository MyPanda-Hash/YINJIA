SET NOCOUNT ON;
SELECT scope, COUNT(*) AS n FROM yj_translation GROUP BY scope ORDER BY scope;
GO
SELECT ref_key, COUNT(DISTINCT locale) AS n FROM yj_translation WHERE scope='field' AND ref_key IN ('存货编码','存货名称','仓库','数量','批号','备注','单价','金额','经手人','单据日期','往来单位') GROUP BY ref_key;
GO
SELECT locale, COUNT(*) AS n FROM yj_translation WHERE scope='panel' AND ref_key IN (N'请购单',N'其他入库单',N'其他出库单',N'委外入库单',N'委外发料单',N'其他入库单明细表',N'其他入库单统计表',N'其他出库单明细表',N'其他出库单统计表',N'委外入库单明细表',N'委外入库单统计表',N'委外发料单明细表',N'委外发料单统计表') GROUP BY locale ORDER BY locale;
