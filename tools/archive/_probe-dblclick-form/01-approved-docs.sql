SET NOCOUNT ON;
PRINT '=== 各单据面板的已审核单据(shr 非空) ===';
SELECT TOP 20 s.panel_code, s.doc_no, s.shr, s.shsj
FROM yj_doc_status s
WHERE s.shr IS NOT NULL AND s.canceled <> 'Y'
  AND s.panel_code IN ('PURCHASE_IN','OTHER_OUT','SALE_OUT','MATERIAL_OUT','QC_INSP','QC_RETURN','SL_RECV','WO_ISSUE','PU_ORDER')
ORDER BY s.shsj DESC;
GO
