SET NOCOUNT ON;
DECLARE @pi nvarchar(60)=N'PI-2026-10-0086', @sl nvarchar(60)=N'SL-2026-10-0171', @ij nvarchar(60)=N'IJ-2026-10-0096',
        @th nvarchar(60)=N'TH-2026-10-0042', @tc nvarchar(60)=N'TCI-2026-10-0057', @po nvarchar(60)=N'PO-2026-10-0051';

PRINT N'══ ① 批次号在「采购订单→送料暂收单」生单那一刻就定稿(台账 yj_doc_batch)══';
SELECT id AS 批次键, source_panel_code AS 来源面板, source_form_no AS 来源单, batch_seq AS 序号,
       batch_no AS 批次号, batch_qty AS 批次数量, status AS 状态, target_panel_code AS 首站面板,
       target_form_no AS 首站单号, RTRIM(remark) AS 备注
  FROM yj_doc_batch WHERE source_form_no = @po;

PRINT N'══ ② 单据上的批次号逐站继承(五单一致)══';
SELECT N'送料暂收单 sl_recv' AS 单据, 单据编号 AS 单号, 批次号, 批次键 FROM sl_recv WHERE 单据编号 = @sl
UNION ALL SELECT N'来料检验单 qc_insp', 单据编号, 批次号, 批次键 FROM qc_insp WHERE 单据编号 = @ij
UNION ALL SELECT N'暂收退回单 qc_return', 单据编号, 批次号, NULL FROM qc_return WHERE 单据编号 = @th
UNION ALL SELECT N'特采单 qc_tc_in', 单据编号, 批次号, 批次键 FROM qc_tc_in WHERE 单据编号 = @tc
UNION ALL SELECT N'采购入库单(合格) bd_purchase_in', 单据编号, 批次号, 批次键 FROM bd_purchase_in WHERE 单据编号 = N'PI-2026-10-0085'
UNION ALL SELECT N'采购入库单(特采) bd_purchase_in', 单据编号, 批次号, 批次键 FROM bd_purchase_in WHERE 单据编号 = @pi;

PRINT N'══ ③ 差的是链路台账那两列,不是单据:form_flow_link 末跳 batch_no=NULL / batch_id 有值 ══';
SELECT source_panel_code AS 源面板, source_form_no AS 源单, target_panel_code AS 目标面板, target_form_no AS 目标单,
       ISNULL(batch_no, N'(NULL)') AS 台账批次号, ISNULL(CONVERT(nvarchar(20), batch_id), N'(NULL)') AS 台账批次键,
       link_status AS 状态
  FROM form_flow_link
 WHERE target_form_no IN (N'PI-2026-10-0085', @pi) AND source_panel_code IN (N'QC_INSP', N'QC_TC_IN')
 ORDER BY target_form_no;

PRINT N'══ ④ 影响面:去向解析走 batch_id(不丢);按批次号反查 linksOfBatch 走 batch_no(丢末跳)══';
DECLARE @bid int = (SELECT TOP 1 batch_id FROM form_flow_link WHERE target_form_no = @pi);
SELECT N'按 batch_id 广搜可达链路行数(去向解析口径)' AS 口径, CONVERT(nvarchar(10), COUNT(*)) AS 命中
  FROM form_flow_link WHERE batch_id = @bid AND link_status = 'ACTIVE'
UNION ALL SELECT N'—— 其中含特采入库跳', CONVERT(nvarchar(10), COUNT(*))
  FROM form_flow_link WHERE batch_id = @bid AND link_status = 'ACTIVE' AND target_form_no = @pi;
SELECT N'按 batch_no 反查(form_flow_link.batch_no 口径)' AS 口径, CONVERT(nvarchar(10), COUNT(*)) AS 命中
  FROM form_flow_link WHERE batch_no = (SELECT TOP 1 batch_no FROM form_flow_link WHERE batch_id = @bid AND ISNULL(batch_no,N'')<>N'')
UNION ALL SELECT N'—— 其中含特采入库跳', CONVERT(nvarchar(10), COUNT(*))
  FROM form_flow_link WHERE batch_no = (SELECT TOP 1 batch_no FROM form_flow_link WHERE batch_id = @bid AND ISNULL(batch_no,N'')<>N'')
    AND target_form_no = @pi;
