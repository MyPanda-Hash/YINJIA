SET NOCOUNT ON;
SELECT h.合同号,
       CASE WHEN s.doc_no IS NULL THEN N'无状态行' ELSE N'有状态行' END AS 状态行,
       ISNULL(s.saved, N'<null>') AS saved, ISNULL(s.canceled, N'<null>') AS canceled,
       ISNULL(s.shr, N'<null>') AS shr, ISNULL(CONVERT(varchar(16), s.shsj, 120), N'<null>') AS shsj,
       ISNULL(s.pending, N'<null>') AS pending
FROM bd_manu_order h LEFT JOIN yj_doc_status s ON s.panel_code='MANU_ORDER' AND s.doc_no=h.合同号
WHERE h.合同号 IN ('MO-2026-09-0095','MO-2026-09-0098');
