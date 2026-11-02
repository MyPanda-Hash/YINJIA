/* 交叉核对第二张卡(页面建卡 LZK-GD-2026-09-0049-1 / 工单行 119)的报工聚合 */
SET NOCOUNT ON;
SELECT p.id AS 工单行id, p.pl_no, p.pl_xc, p.pl_sl AS 排产数量
  FROM dbo.plang p WHERE p.id IN (119,123);
GO
SELECT p.id AS 工单行id, l.工序序, l.工序, CONVERT(float, ISNULL(l.计划数量,0)) AS 台账计划数量
  FROM dbo.plang p JOIN dbo.wo_process_line l ON l.工单行id=p.id AND ISNULL(l.asp_cancel,'N')<>'Y'
 WHERE p.id IN (119,123) ORDER BY p.id, ISNULL(l.工序序,999);
GO
SELECT p.id AS 工单行id, s.gxdm AS 工序,
       SUM(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 已报工,
       SUM(CASE WHEN ISNULL(s.wgzt,'N')<>'Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 待审核,
       COUNT(*) AS 报工单数
  FROM dbo.plang p JOIN dbo.scjl s ON s.gldh=p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y'
   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id=s.gd_id AND pc.plang_id=p.id)
        OR (ISNULL(s.gd_id,0)=0 AND (ISNULL(s.[批次号],N'')=ISNULL(p.[批次号],N'') OR ISNULL(s.[批次号],N'')=N'')))
 WHERE p.id IN (119,123) GROUP BY p.id, s.gxdm ORDER BY p.id, s.gxdm;
GO
SELECT id AS 卡id, 卡号, 工单行id, 大批次号, 卡状态 FROM dbo.wo_proc_card_head WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT d.卡号, d.工序序, d.工序, CONVERT(float, ISNULL(d.计划数量,0)) AS 卡内计划数量
  FROM dbo.wo_proc_card_detail d WHERE ISNULL(d.asp_cancel,'N')<>'Y' ORDER BY d.卡号, d.工序序;
GO
