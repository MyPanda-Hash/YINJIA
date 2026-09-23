-- _q-inv-line-cols.sql — 列存在性矩阵:迁移要引用的每个列在每张表是否存在(错名整视图失败)
SET NOCOUNT ON;
DECLARE @t TABLE (tbl sysname, kind char(1));
INSERT INTO @t VALUES
 ('bl_purchase_in','L'),('bl_finish_in','L'),('bl_other_in','L'),('bl_outsource_in','L'),
 ('bl_sale_out','L'),('bl_material_out','L'),('bl_other_out','L'),('bl_outsource_issue','L'),
 ('bd_purchase_in','H'),('bd_finish_in','H'),('bd_other_in','H'),('bd_outsource_in','H'),
 ('bd_sale_out','H'),('bd_material_out','H'),('bd_other_out','H'),('bd_outsource_issue','H'),
 ('bs_wh','W');

DECLARE @cand TABLE (col sysname);
INSERT INTO @cand VALUES
 (N'id'),(N'仓库'),(N'仓库编码'),(N'批号'),(N'规格型号'),(N'计量单位'),(N'存货图片'),
 (N'存货编码'),(N'存货名称'),(N'产品编码'),(N'产品名称'),(N'材料编码'),(N'材料名称'),
 (N'实收数量'),(N'数量'),(N'金额'),(N'销售金额'),(N'单价'),(N'含税金额'),(N'税额'),(N'含税单价'),
 (N'单据日期'),(N'单据编号'),(N'单据状态'),(N'单据状态2'),(N'业务类型'),
 (N'供应商'),(N'供应商编码'),(N'客户'),(N'客户编码'),(N'经手人'),(N'领用人'),(N'asp_cancel');

SELECT t.tbl,
       ISNULL(STUFF((SELECT N',' + c.col
                     FROM @cand c
                     WHERE EXISTS (SELECT 1 FROM sys.columns sc
                                   WHERE sc.object_id = OBJECT_ID(N'dbo.' + t.tbl) AND sc.name = c.col)
                     ORDER BY c.col FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N''),
              N'(无)') AS 存在的列
FROM @t t ORDER BY t.kind, t.tbl;
GO
