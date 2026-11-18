SET NOCOUNT ON;
PRINT '=== 委托单头(全部) ===';
SELECT id, 单据编号, 单据日期, 联系人, 样品名称, 单据状态, 审核人, 审核时间, asp_user1, asp_time1, asp_time2, asp_cancel
  FROM qc_insp_commission_head ORDER BY id;
PRINT '=== yj_doc_status(INSP_COMMISSION) ===';
SELECT id, doc_no, shr, shsj, canceled, pending, pending_by, stopped, saved, archived, update_at
  FROM yj_doc_status WHERE panel_code='INSP_COMMISSION' ORDER BY id;
PRINT '=== 明细按单号 ===';
SELECT 单据编号, COUNT(*) n FROM qc_insp_commission_detail GROUP BY 单据编号;
GO
