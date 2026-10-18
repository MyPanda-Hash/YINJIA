SET NOCOUNT ON;
SELECT [单据编号], asp_cancel FROM bd_transfer ORDER BY id;
SELECT [单据编号], [存货编码], [调出仓库], [调入仓库], [数量] FROM bl_transfer ORDER BY id;
SELECT [单据编号], asp_cancel FROM bd_stocktake ORDER BY id;
SELECT [单据编号], [存货编码], [仓库], [账面数量], [实盘数量] FROM bl_stocktake ORDER BY id;
