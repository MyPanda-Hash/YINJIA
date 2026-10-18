SET NOCOUNT ON;
PRINT '===== 1) 销售订单:服务器新增(本地没有) =====';
SELECT s.单据编号, s.单据日期, s.客户, s.单据状态, s.审核时间, s.修改时间, s.asp_time1
FROM HSDZ_MES_SRV1017.dbo.bd_so_order s
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.dbo.bd_so_order l WHERE l.单据编号 = s.单据编号)
ORDER BY s.单据编号;
PRINT '===== 2) 销售订单:本地有服务器没有 =====';
SELECT l.单据编号, l.单据日期, l.客户, l.单据状态
FROM HSDZ_MES.dbo.bd_so_order l
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES_SRV1017.dbo.bd_so_order s WHERE s.单据编号 = l.单据编号)
ORDER BY l.单据编号;

PRINT '===== 3) 采购订单:服务器新增 / 本地有服务器无 =====';
SELECT 'SRV' AS 来源, 单据编号, 单据日期, 供应商, 单据状态 FROM HSDZ_MES_SRV1017.dbo.bd_pu_order s
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.dbo.bd_pu_order l WHERE l.单据编号=s.单据编号)
UNION ALL
SELECT 'LOC', 单据编号, 单据日期, 供应商, 单据状态 FROM HSDZ_MES.dbo.bd_pu_order l
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES_SRV1017.dbo.bd_pu_order s WHERE s.单据编号=l.单据编号)
ORDER BY 来源, 单据编号;

PRINT '===== 4) yj_doc_status 服务器独有 按面板 =====';
SELECT s.panel_code AS 面板, COUNT(*) AS 服务器独有 FROM HSDZ_MES_SRV1017.dbo.yj_doc_status s
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.dbo.yj_doc_status l WHERE l.panel_code=s.panel_code AND l.doc_no=s.doc_no)
GROUP BY s.panel_code ORDER BY 2 DESC;
PRINT '===== 5) yj_doc_status 本地独有 按面板 =====';
SELECT l.panel_code AS 面板, COUNT(*) AS 本地独有 FROM HSDZ_MES.dbo.yj_doc_status l
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES_SRV1017.dbo.yj_doc_status s WHERE s.panel_code=l.panel_code AND s.doc_no=l.doc_no)
GROUP BY l.panel_code ORDER BY 2 DESC;

PRINT '===== 6) 服务器独有业务单据 =====';
SELECT 'QC_TC_IN' AS 表, 单据编号, 单据日期, 供应商, 单据状态 FROM HSDZ_MES_SRV1017.dbo.qc_tc_in s
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.dbo.qc_tc_in l WHERE l.id=s.id);
SELECT 'SCJL' AS 表, sc_no AS 报工单号, mc AS 产品, sc_date AS 日期, gxdm AS 工序, sl AS 数量, dwzt AS 状态 FROM HSDZ_MES_SRV1017.dbo.scjl s
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.dbo.scjl l WHERE l.id=s.id AND l.comm=s.comm);
SELECT 'WO_PROCESS_LINE' AS 表, 工单号, 工单行id, 工序, 工序序, 计划数量, 状态 FROM HSDZ_MES_SRV1017.dbo.wo_process_line s
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.dbo.wo_process_line l WHERE l.id=s.id);
SELECT 'WO_TRANSFER_LOG' AS 表, pl_no AS 工单, 批次号, 数量 FROM HSDZ_MES_SRV1017.dbo.wo_transfer_log s
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.dbo.wo_transfer_log l WHERE l.id=s.id);
SELECT 'YJ_ATTACHMENT' AS 表, panel_code AS 面板, doc_no AS 单号, file_name AS 文件, file_size AS 字节, asp_time1 AS 上传时间 FROM HSDZ_MES_SRV1017.dbo.yj_attachment s
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.dbo.yj_attachment l WHERE l.id=s.id);

PRINT '===== 7) 审批留痕 yj_form_approval 服务器独有 =====';
SELECT panel_code AS 面板, form_no AS 单号, action AS 动作, result AS 结果, node_no AS 节点, operator AS 操作人, create_time AS 时间
FROM HSDZ_MES_SRV1017.dbo.yj_form_approval s
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.dbo.yj_form_approval l WHERE l.id=s.id) ORDER BY create_time;

PRINT '===== 8) 站点消息 yj_message 服务器独有 =====';
SELECT TOP 10 id, 收件人, 消息码, 面板编码, 单据编号, 已读, 创建时间 FROM HSDZ_MES_SRV1017.dbo.yj_message s
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.dbo.yj_message l WHERE l.id=s.id) ORDER BY id DESC;

