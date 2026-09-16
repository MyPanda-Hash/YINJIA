SET NOCOUNT ON;
SELECT 单据编号, 单据状态, 是否已转ERP, ERP单号 FROM bd_purchase_in WHERE 单据编号 = 'CGRK-20260916-03215';
SELECT doc_no, shr FROM yj_doc_status WHERE panel_code='PURCHASE_IN' AND doc_no='CGRK-20260916-03215';
