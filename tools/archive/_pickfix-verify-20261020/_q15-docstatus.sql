SET NOCOUNT ON;
SELECT 单据编号, 单据日期, asp_cancel, asp_time1,
       (SELECT TOP 1 canceled FROM yj_doc_status s WHERE s.doc_no = h.单据编号 AND s.panel_code = N'MATERIAL_OUT') AS 状态_取消
  FROM dbo.bd_material_out h
 WHERE 单据编号 IN (N'LL-2026-10-0001', N'LL-2026-10-0002', N'LL-2026-10-0003', N'CL-2026-10-0125', N'CL-2026-10-0124');
SELECT COUNT(*) AS 本地活动材料出库单 FROM dbo.bd_material_out WHERE ISNULL(asp_cancel,'N') <> 'Y';
SELECT COUNT(*) AS 本地全部材料出库单 FROM dbo.bd_material_out;
SELECT COUNT(*) AS yj_doc_status取消数 FROM dbo.yj_doc_status WHERE panel_code = N'MATERIAL_OUT' AND ISNULL(canceled,'N') = 'Y';
