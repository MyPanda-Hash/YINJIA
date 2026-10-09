-- _v-chain.sql(由 _v-gen-chain-sql.cjs 依据最近一次 E2E 结果生成;勿手改)
SET NOCOUNT ON;
DECLARE @po nvarchar(60)=N'PO-2026-10-0051', @sl nvarchar(60)=N'SL-2026-10-0171', @ij nvarchar(60)=N'IJ-2026-10-0096',
        @th nvarchar(60)=N'TH-2026-10-0042', @tc nvarchar(60)=N'TCI-2026-10-0057',
        @piPass nvarchar(60)=N'PI-2026-10-0085', @piTc nvarchar(60)=N'PI-2026-10-0086',
        @piFree nvarchar(60)=N'PI-2026-10-0083', @piAllPass nvarchar(60)=N'PI-2026-10-0084',
        @tcManual nvarchar(60)=N'TCI-2026-10-0059', @batch nvarchar(60)=NULL;
SELECT @batch = 批次号 FROM qc_insp WHERE 单据编号 = @ij;

PRINT N'══ 1. 单据状态与审批留痕(yj_doc_status)══';
SELECT s.panel_code AS 面板, s.doc_no AS 单据号, s.shr AS 审核人, s.sj AS 审核时间,
       s.canceled AS 已作废, s.pending AS 待审批, s.saved AS 已存, s.l1 AS 一级, s.l2 AS 二级批
  FROM (SELECT panel_code, doc_no, RTRIM(shr) AS shr, CONVERT(nvarchar(19), shsj, 120) AS sj,
               ISNULL(canceled,'N') AS canceled, ISNULL(pending,'N') AS pending, ISNULL(saved,'N') AS saved,
               ISNULL(CONVERT(nvarchar(10), approve_node), '') AS l1, ISNULL(l2_approver,'') AS l2
          FROM yj_doc_status) s
 WHERE s.doc_no IN (@po,@sl,@ij,@th,@tc,@piPass,@piTc,@piFree,@piAllPass,@tcManual);

PRINT N'══ 2. 链路台账 form_flow_link(P5 特采全链的四跳)══';
SELECT source_panel_code AS 源面板, source_form_no AS 源单, target_panel_code AS 目标面板, target_form_no AS 目标单,
       inventory_code AS 物料, source_quantity AS 源数量, linked_quantity AS 已用数量, batch_no AS 批次号,
       link_status AS 链路状态, RTRIM(create_by) AS 建链人
  FROM form_flow_link
 WHERE source_form_no IN (@po,@sl,@ij,@th,@tc) OR target_form_no IN (@ij,@th,@tc,@piPass,@piTc)
 ORDER BY id;

PRINT N'══ 3. 数量守恒(采购 → 检验 → 入库+退回 → 特采 → 入库)══';
SELECT N'采购订单数量' AS 环节, 数量 AS 值 FROM bl_pu_order WHERE 单据编号 = @po
UNION ALL SELECT N'送料暂收数量', 数量 FROM sl_recv_detail WHERE 单据编号 = @sl
UNION ALL SELECT N'检验·送检数量', 送检数量 FROM qc_insp_detail WHERE 单据编号 = @ij
UNION ALL SELECT N'检验·合格数量', 合格数量 FROM qc_insp_detail WHERE 单据编号 = @ij
UNION ALL SELECT N'检验·不合格数量', 不合格数量 FROM qc_insp_detail WHERE 单据编号 = @ij
UNION ALL SELECT N'入库单(合格部分)实收', 实收数量 FROM bl_purchase_in WHERE 单据编号 = @piPass
UNION ALL SELECT N'退回单退货数量', 退货数量 FROM qc_return_detail WHERE 单据编号 = @th
UNION ALL SELECT N'特采单不合格品数量', 不合格品数量 FROM qc_tc_in WHERE 单据编号 = @tc
UNION ALL SELECT N'入库单(特采)实收', 实收数量 FROM bl_purchase_in WHERE 单据编号 = @piTc;

PRINT N'══ 4. 特采标记与来料检验标记(采购入库明细)══';
SELECT 单据编号, 存货编码, 实收数量, 是否来料检验, 特采, 仓库, 仓库编码, 批次号
  FROM bl_purchase_in WHERE 单据编号 IN (@piFree,@piAllPass,@piPass,@piTc) ORDER BY 单据编号;

PRINT N'══ 5. 批次号全链一致性(P5 链)══';
SELECT N'sl_recv' AS 表, 单据编号 AS 单据号, 批次号 FROM sl_recv WHERE 单据编号 = @sl
UNION ALL SELECT N'qc_insp', 单据编号, 批次号 FROM qc_insp WHERE 单据编号 = @ij
UNION ALL SELECT N'qc_return', 单据编号, 批次号 FROM qc_return WHERE 单据编号 = @th
UNION ALL SELECT N'qc_tc_in', 单据编号, 批次号 FROM qc_tc_in WHERE 单据编号 = @tc
UNION ALL SELECT N'bd_purchase_in', 单据编号, 批次号 FROM bd_purchase_in WHERE 单据编号 IN (@piPass,@piTc);

PRINT N'══ 6. 库存记账(已审核入库单应已进台账/流水)══';
SELECT N'kucun 原料仓/华北工控仓行' AS 项, COUNT(*) AS 行数 FROM kucun WHERE ckdm = N'CK00006'
UNION ALL SELECT N'inh 流水(kucun库)', COUNT(*) FROM kucun
UNION ALL SELECT N'已审核入库单数', COUNT(*) FROM bd_purchase_in p
  WHERE p.单据编号 IN (@piFree,@piAllPass,@piPass,@piTc) AND NOT EXISTS
        (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='PURCHASE_IN' AND s.doc_no=p.单据编号 AND ISNULL(s.canceled,'N')='Y');

PRINT N'══ 7. 特采单终态(含无来源链路的手工单)══';
SELECT 单据编号, 总数量, 不合格品数量, 不合格品比例, 检验单号, 暂收退料单号, 批次号, 编制人, 审核人
  FROM qc_tc_in WHERE 单据编号 IN (@tc, @tcManual);

PRINT N'══ 8. 退回单「特采」勾选落库 ══';
SELECT 单据编号, 物料编码, 退货数量, 送检数量, 特采 FROM qc_return_detail WHERE 单据编号 = @th;
