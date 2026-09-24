SET NOCOUNT ON;
PRINT '== ① 五面板 计量单位 字段行 ==';
SELECT panel_code, col_name, place, hidden, visible, seq FROM yj_field
 WHERE col_name LIKE N'计量单位%' AND panel_code IN ('PU_ORDER','QC_RECV','QC_INSP','PURCHASE_IN','QC_RETURN')
 ORDER BY panel_code, col_name;
PRINT '== ② sl_recv_detail 物理列与数据 ==';
SELECT CASE WHEN COL_LENGTH('dbo.sl_recv_detail',N'计量单位') IS NULL THEN '缺列' ELSE '有列' END AS 计量单位列,
       CASE WHEN COL_LENGTH('dbo.sl_recv_detail',N'计量单位2') IS NULL THEN '缺列' ELSE '有列' END AS 计量单位2列;
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN ISNULL(计量单位,'')<>'' THEN 1 ELSE 0 END) AS 有计量单位,
       SUM(CASE WHEN ISNULL(计量单位2,'')<>'' THEN 1 ELSE 0 END) AS 有计量单位2
  FROM sl_recv_detail;
PRINT '== ③ 下游检验/入库 计量单位填充(最近10行) ==';
SELECT TOP 10 单据编号, 物料编码, 计量单位, 送检数量 FROM qc_insp_detail ORDER BY id DESC;
SELECT TOP 10 单据编号, 存货编码, 计量单位, 实收数量 FROM bl_purchase_in ORDER BY id DESC;
GO
