SET NOCOUNT ON;
-- 取一个 C 组单据的物料,看库存与单据状态
DECLARE @no nvarchar(60), @code nvarchar(120);
SELECT TOP 1 @no = 领料单号 FROM wo_pick_doc WHERE 工单号='GD-STG-C01';
SELECT TOP 1 @code = 材料编码 FROM bl_material_out WHERE 单据编号=@no;
SELECT @no 领料单, @code 物料;
SELECT 'kucun 现存量' k, CAST(yl AS nvarchar) v FROM kucun WHERE wzdm=@code AND ckdm='YCL-01'
UNION ALL SELECT 'v_stock_pick', CAST(现存量 AS nvarchar) FROM v_stock_pick WHERE 存货编码=@code AND 仓库='恒亿仓';
GO
-- 该单据是否已审核过账(看库存流水)
SELECT TOP 3 单据编号, 物料编码, 数量 FROM outh WHERE 单据编号 = (SELECT TOP 1 领料单号 FROM wo_pick_doc WHERE 工单号='GD-STG-C01');
