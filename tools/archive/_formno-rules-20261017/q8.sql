SET NOCOUNT ON;
PRINT '== PI 前缀在两表的实际占用 ==';
SELECT N'采购入库单 bd_purchase_in' AS tbl, COUNT(*) AS rows_all,
       SUM(CASE WHEN 单据编号 LIKE N'PI-%' THEN 1 ELSE 0 END) AS pi_rows,
       MIN(单据编号) AS min_no, MAX(单据编号) AS max_no
FROM bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'产品信息表 rd_prod_info_head', COUNT(*),
       SUM(CASE WHEN 单据编号 LIKE N'PI-%' THEN 1 ELSE 0 END), MIN(单据编号), MAX(单据编号)
FROM rd_prod_info_head WHERE ISNULL(asp_cancel,'N')<>'Y';
PRINT '== SO 前缀 ==';
SELECT N'销售出库单 bd_sale_out' AS tbl, COUNT(*) AS rows_all, MIN(单据编号) AS min_no, MAX(单据编号) AS max_no
FROM bd_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'销售订单 bd_so_order', COUNT(*), MIN(单据编号), MAX(单据编号) FROM bd_so_order WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'客户订单 order_bt', COUNT(*), MIN(od_no), MAX(od_no) FROM order_bt;
PRINT '== GD 前缀 ==';
SELECT N'生产工单 bd_manu_order' AS tbl, COUNT(*) AS rows_all, MIN(合同号) AS min_no, MAX(合同号) AS max_no
FROM bd_manu_order WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'旧版工单 wo_order', COUNT(*), MIN(单据编号), MAX(单据编号) FROM wo_order WHERE ISNULL(asp_cancel,'N')<>'Y';
PRINT '== 各单据表行数(判断哪些面板在用) ==';
SELECT N'采购订单 bd_pu_order' AS t, COUNT(*) AS n FROM bd_pu_order WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'送料暂收单 sl_recv', COUNT(*) FROM sl_recv WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'来料检验单 qc_insp', COUNT(*) FROM qc_insp WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'暂收退料单 qc_return', COUNT(*) FROM qc_return WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'采购单 Porder(遗留)', COUNT(*) FROM Porder
UNION ALL SELECT N'物料清单 mate(遗留)', COUNT(*) FROM mate
UNION ALL SELECT N'销售订单 bd_so_order', COUNT(*) FROM bd_so_order WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'销售出库单 bd_sale_out', COUNT(*) FROM bd_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'产成品入库 bd_finish_in', COUNT(*) FROM bd_finish_in WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'材料出库 bd_material_out', COUNT(*) FROM bd_material_out WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'其他入库 bd_other_in', COUNT(*) FROM bd_other_in WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'其他出库 bd_other_out', COUNT(*) FROM bd_other_out WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'委外加工单 bd_outsource_order', COUNT(*) FROM bd_outsource_order WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'工序派工单 bd_dispatch', COUNT(*) FROM bd_dispatch WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'样品申请单 sample_req', COUNT(*) FROM sample_req WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'保养计划 maint_plan', COUNT(*) FROM maint_plan WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'生产日报 day_report', COUNT(*) FROM day_report WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'工序报工单 scjl', COUNT(*) FROM scjl WHERE ISNULL(asp_cancel,'N')<>'Y';
