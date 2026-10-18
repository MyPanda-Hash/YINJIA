-- 只读自检:把「ja 被写成 Y」当成前提,验证「结案异常」判定式能识别出来(不改任何数据)
WITH x AS (
    SELECT p.*, 'Y' AS fake_ja FROM dbo.plang p WHERE p.pl_no = 'GD-2026-10-0220'
)
SELECT pl_no, pl_xc, fake_ja,
       ISNULL(pl_sl,0) AS pl_sl, ISNULL(rk_sl,0) AS rk_sl,
       CASE WHEN fake_ja IN (N'T', N'Y')
             AND NOT (ISNULL(pl_sl,0) > 0 AND ISNULL(rk_sl,0) >= ISNULL(pl_sl,0))
             AND NOT EXISTS (SELECT 1 FROM dbo.qc_asm_insp_head h
                   JOIN dbo.yj_doc_status ds ON ds.panel_code = N'QC_ASM_INSP' AND ds.doc_no = h.[单据编号]
                   WHERE h.[工单号] = x.pl_no AND ISNULL(h.asp_cancel,'N') <> 'Y'
                     AND ds.shr IS NOT NULL AND ISNULL(ds.canceled,'N') <> 'Y' AND ISNULL(ds.stopped,'N') <> 'Y'
                     AND (ISNULL(h.[工单行号],0) = ISNULL(x.pl_xc,0)
                          OR (ISNULL(h.[工单行号],0) = 0 AND ISNULL(h.[批次号],N'') <> N''
                              AND ISNULL(h.[批次号],N'') = ISNULL(x.[批次号],N''))))
            THEN N'Y' ELSE N'N' END AS 结案异常
FROM x;
