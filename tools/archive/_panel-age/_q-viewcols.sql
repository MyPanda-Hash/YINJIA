SET NOCOUNT ON;
-- 三个待重建视图所需列是否都在(缺一列 CREATE VIEW 就会失败)
DECLARE @need TABLE (tbl sysname, col sysname);
INSERT INTO @need(tbl,col) VALUES
 ('bd_finish_in','id'),('bd_finish_in','asp_cancel'),('bd_finish_in','单据日期'),('bd_finish_in','asp_time1'),
 ('bd_finish_in','单据编号'),('bd_finish_in','业务类型'),('bd_finish_in','仓库'),('bd_finish_in','入库类别'),
 ('bd_finish_in','生产车间'),('bd_finish_in','经手人'),('bd_finish_in','备注'),('bd_finish_in','asp_user1'),('bd_finish_in','项目'),
 ('bl_finish_in','id'),('bl_finish_in','产品名称'),('bl_finish_in','规格型号'),('bl_finish_in','计量单位'),
 ('bl_finish_in','实收数量'),('bl_finish_in','单价'),('bl_finish_in','金额'),
 ('yj_doc_status','panel_code'),('yj_doc_status','doc_no'),('yj_doc_status','shr'),('yj_doc_status','canceled'),
 ('bd_manu_order','合同号'),('bd_manu_order','完工日期'),('bd_manu_order','asp_cancel'),
 ('bl_manu_order','产品编码'),('bl_manu_order','产品名称'),('bl_manu_order','规格型号'),('bl_manu_order','生产单位'),
 ('bl_manu_order','数量'),('bl_manu_order','累计汇报套数(工序单位)');
SELECT n.tbl, n.col FROM @need n
WHERE OBJECT_ID(n.tbl) IS NULL OR COL_LENGTH(n.tbl, n.col) IS NULL;
SELECT '缺失列数(期望 0)' AS k, COUNT(*) AS n FROM @need n
WHERE OBJECT_ID(n.tbl) IS NULL OR COL_LENGTH(n.tbl, n.col) IS NULL;
