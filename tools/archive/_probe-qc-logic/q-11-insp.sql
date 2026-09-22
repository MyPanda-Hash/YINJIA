SET NOCOUNT ON;
SELECT 'A.QC_INSP明细字段' AS k, col_name, label, data_type, place FROM yj_field WHERE panel_code='QC_INSP' AND place LIKE '%detail%' ORDER BY seq;
SELECT TOP 3 'C.最近检验单' AS k, 单据编号, 单据日期, 批次号, 暂收单号, 采购订单号 FROM qc_insp ORDER BY id DESC;
SELECT TOP 6 'D.检验明细样例' AS k, 单据编号, 物料编码, 物料名称, 单位, 计量单位, 送检数量, 数量, 批次号 FROM qc_insp_detail ORDER BY id DESC;
SELECT TOP 5 'E.商品所属类别样例' AS k, 存货编码, 存货名称, 所属类别, 计量单位 FROM bs_inv WHERE ISNULL(所属类别,N'') <> N'' ORDER BY id;
GO
