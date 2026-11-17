SET NOCOUNT ON;
PRINT N'=== 汇总取数 SQL 冒烟(2026-11-01 ~ 2026-11-17) ===';
SELECT TOP 20000 * FROM (
  SELECT  h.单据编号 AS 单据编号, h.单据日期 AS 单据日期,
          ISNULL(NULLIF(LTRIM(RTRIM(h.联系人)), N''), N'未填送样人') AS 送样人,
          ISNULL(h.委托单位, N'') AS 委托单位,
          ISNULL(h.样品名称, N'') AS 样品名称,
          ISNULL(h.样品型号规格, N'') AS 样品类别,
          ISNULL(h.样品数量, N'') AS 样品数量,
          ISNULL(h.检验类别, N'') AS 检验类别,
          ISNULL(h.检验项目及要求, N'') AS 检验项目及要求,
          h.合计收费 AS 合计收费, ISNULL(h.审核人, N'') AS 审核人, h.审核时间 AS 审核时间,
          d.行号 AS 行号,
          ISNULL(d.检测元素, N'') AS 检测元素,
          ISNULL(d.测试方法, N'') AS 测试方法,
          ISNULL(d.测试周期, N'') AS 测试周期,
          d.收费 AS 项目收费,
          CASE WHEN ds.shr IS NULL AND ds.canceled IS NULL AND ds.stopped IS NULL AND ds.pending IS NULL
               THEN COALESCE(CASE WHEN h.审核时间 IS NOT NULL THEN N'已审核'
                                  ELSE NULLIF(h.单据状态, N'') END, N'草稿')
               WHEN ISNULL(ds.canceled, 'N') = 'Y' THEN N'已作废'
               WHEN ISNULL(ds.stopped, 'N') = 'Y' THEN N'已中止'
               WHEN ISNULL(ds.pending, 'N') = 'Y' THEN N'审批中'
               WHEN ISNULL(ds.shr, N'') <> N'' THEN N'已审核'
               ELSE N'草稿' END AS 单据状态
    FROM dbo.qc_insp_commission_head h
    LEFT JOIN dbo.qc_insp_commission_detail d ON d.单据编号 = h.单据编号
    OUTER APPLY (SELECT TOP 1 s.shr, s.canceled, s.stopped, s.pending
                   FROM dbo.yj_doc_status s
                  WHERE s.panel_code = N'INSP_COMMISSION' AND s.doc_no = h.单据编号
                  ORDER BY s.id DESC) ds
   WHERE ISNULL(h.asp_cancel, N'N') <> N'Y'
     AND h.单据日期 >= '2026-11-01' AND h.单据日期 <= '2026-11-17'
) t
WHERE 单据状态 IN (N'草稿', N'审批中', N'已审核')
ORDER BY 单据日期 DESC, 单据编号 DESC, 行号;
GO
