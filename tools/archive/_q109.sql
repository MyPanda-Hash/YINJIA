SET NOCOUNT ON;
-- 当前所有采购入库的状态
SELECT 单据编号, 单据状态, 是否已转ERP, ERP单号, 转ERP操作人, 转ERP时间 FROM bd_purchase_in ORDER BY id DESC;
-- yj_doc_status 状态
SELECT doc_no, shr, shsj FROM yj_doc_status WHERE panel_code='PURCHASE_IN' ORDER BY doc_no;
