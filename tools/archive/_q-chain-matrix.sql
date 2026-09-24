SET NOCOUNT ON;
PRINT '== 全链路关键明细字段注册矩阵(0/V=可见,1/=隐藏,-=未注册) ==';
SELECT col_name,
  MAX(CASE WHEN panel_code='PU_ORDER'    THEN CAST(ISNULL(hidden,0) AS nvarchar) + CASE WHEN visible=1 THEN '/V' ELSE '/' END ELSE '-' END) AS 订单,
  MAX(CASE WHEN panel_code='QC_RECV'     THEN CAST(ISNULL(hidden,0) AS nvarchar) + CASE WHEN visible=1 THEN '/V' ELSE '/' END ELSE '-' END) AS 暂收,
  MAX(CASE WHEN panel_code='QC_INSP'     THEN CAST(ISNULL(hidden,0) AS nvarchar) + CASE WHEN visible=1 THEN '/V' ELSE '/' END ELSE '-' END) AS 检验,
  MAX(CASE WHEN panel_code='PURCHASE_IN' THEN CAST(ISNULL(hidden,0) AS nvarchar) + CASE WHEN visible=1 THEN '/V' ELSE '/' END ELSE '-' END) AS 入库,
  MAX(CASE WHEN panel_code='QC_RETURN'   THEN CAST(ISNULL(hidden,0) AS nvarchar) + CASE WHEN visible=1 THEN '/V' ELSE '/' END ELSE '-' END) AS 退回
  FROM yj_field
 WHERE panel_code IN ('PU_ORDER','QC_RECV','QC_INSP','PURCHASE_IN','QC_RETURN')
   AND col_name IN (N'物料编码',N'物料名称',N'存货编码',N'存货名称',N'规格型号',N'计量单位',N'单位',
                    N'数量',N'送检数量',N'实收数量',N'单价',N'金额',N'批次号',N'采购订单号',N'采购订单行号',N'仓库',N'供应商代码',N'供应商编码')
   AND place LIKE '%detail%'
 GROUP BY col_name ORDER BY col_name;
GO
