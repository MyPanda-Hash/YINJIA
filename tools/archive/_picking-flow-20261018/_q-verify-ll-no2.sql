SET NOCOUNT ON;
PRINT '=== 回写结果(plang / plang_pc) ==='
SELECT p.id, p.pl_no, p.pl_xc, p.ll_no2 AS plang_ll_no2, LEN(ISNULL(p.ll_no2,N'')) AS len,
       (SELECT TOP 1 pc2.ll_no2 FROM dbo.plang_pc pc2 WHERE pc2.plang_id=p.id AND ISNULL(pc2.asp_cancel,'N')<>'Y') AS pc_ll_no2
FROM dbo.plang p
WHERE p.pl_no=N'GD-2026-10-0001' AND ISNULL(p.pl_xc,0)=3 AND ISNULL(p.asp_cancel,'N')<>'Y';
GO
PRINT '=== 两张探针单的审核状态 ==='
SELECT h.[单据编号], s.shr, CASE WHEN s.canceled='Y' THEN N'作废' WHEN s.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END AS st
FROM bd_material_out h LEFT JOIN yj_doc_status s ON s.panel_code='MATERIAL_OUT' AND s.doc_no=h.[单据编号]
WHERE h.[单据编号] IN (N'CL-2026-10-0070',N'CL-2026-10-0071');
GO
