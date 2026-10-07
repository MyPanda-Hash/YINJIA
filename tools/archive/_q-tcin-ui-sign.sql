SET NOCOUNT ON;
SELECT N'1-TCIN-SIGN' AS seg, 单据编号, 编制人, 审核人, 审核时间, 审批人, 审批时间, 单据状态
FROM qc_tc_in WHERE 单据编号 LIKE 'TCI-2026-10-%' ORDER BY id DESC;
SELECT N'2-DOCSTATUS' AS seg, doc_no, ISNULL(shr,'') AS shr, ISNULL(pending,'') AS pending,
       CAST(approve_node AS varchar(10)) AS approve_node
FROM yj_doc_status WHERE panel_code='QC_TC_IN' ORDER BY id DESC;
