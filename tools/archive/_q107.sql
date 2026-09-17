SET NOCOUNT ON;
-- 查用户说的单据状态(yj_doc_status + bd_purchase_in)
SELECT N'bd_purchase_in' AS src, 单据编号, 单据状态, 是否已转ERP, ERP单号 FROM bd_purchase_in WHERE 单据编号 LIKE 'PI-%' AND 单据状态 <> N'草稿';
-- yj_doc_status 里 PI- 开头的
SELECT N'yj_doc_status' AS src, panel_code, doc_no, shr, shsj FROM yj_doc_status WHERE panel_code='PURCHASE_IN' AND doc_no LIKE 'PI-%';
-- 所有已审核的
SELECT N'已审核' AS src, 单据编号, 是否已转ERP, ERP单号 FROM bd_purchase_in WHERE 单据状态 = N'已审核' OR 是否已转ERP = N'是';
