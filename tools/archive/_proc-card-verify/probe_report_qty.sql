/* 交叉核对:工单行 1168 的「已审核报工」按工序汇总(与 ProcCardService.opAggs 同锚点,独立手写)
   锚点 = scjl.gd_id → plang_pc.plang_id = plang.id(草稿期 gd_id=0 时按批次号/空批次兜底)
   输出列:工序 | 已报工(wgzt=Y 的 sl 合计) | 待审核(其余) | 完成时间(max wgsj) | 报工单数 */
SET NOCOUNT ON;
DECLARE @rowId bigint = 1168;
SELECT s.gxdm AS 工序,
       SUM(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 已报工,
       SUM(CASE WHEN ISNULL(s.wgzt,'N')<>'Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 待审核,
       CONVERT(varchar(19), MAX(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN s.wgsj END),120) AS 完成时间,
       COUNT(*) AS 报工单数
  FROM dbo.plang p
  JOIN dbo.scjl s ON s.gldh = p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y'
   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pca WHERE pca.id = s.gd_id AND pca.plang_id = p.id)
        OR (ISNULL(s.gd_id,0)=0 AND (ISNULL(s.[批次号],N'')=ISNULL(p.[批次号],N'') OR ISNULL(s.[批次号],N'')=N'')))
 WHERE p.id = @rowId
 GROUP BY s.gxdm
 ORDER BY s.gxdm;
GO
/* 另:该行工序台账(卡的工序行来源)快照 */
SELECT l.工序序, l.工序, CONVERT(float, ISNULL(l.计划数量,0)) AS 计划数量
  FROM dbo.wo_process_line l
 WHERE l.工单行id = 1168 AND ISNULL(l.asp_cancel,'N')<>'Y'
 ORDER BY ISNULL(l.工序序,999), l.id;
GO
/* 另:整单报工明细(卡「报工记录」数据源) */
SELECT ISNULL(s.[报工单号],N'') AS 报工单号, ISNULL(s.gxdm,N'') AS 工序, ISNULL(s.sl,0) AS 报工数量,
       ISNULL(s.ywman,N'') AS 报工人, ISNULL(s.wgzt,N'N') AS 完工状态, CONVERT(varchar(19), s.sc_date,120) AS 单据日期
  FROM dbo.scjl s
 WHERE s.gldh = N'GD-2026-10-0223' AND ISNULL(s.asp_cancel,'N')<>'Y'
   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id=s.gd_id AND pc.plang_id=1168)
        OR (ISNULL(s.gd_id,0)=0 AND (ISNULL(s.[批次号],N'')=ISNULL(N'',N'') OR ISNULL(s.[批次号],N'')=N'')))
 ORDER BY s.id DESC;
GO
