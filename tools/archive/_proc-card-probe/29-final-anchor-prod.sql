SET NOCOUNT ON;

SELECT N'--- ① opAggs(最终版:报工批次=plang.[批次号] 原值 + 空批次兜底) ---' AS x;
SELECT a.工单行id AS 行id, s.gxdm AS 工序,
       SUM(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 已报工,
       SUM(CASE WHEN ISNULL(s.wgzt,'N')<>'Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 待审核,
       CONVERT(varchar(19), MAX(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN s.wgsj END),120) AS 完成时间,
       COUNT(*) AS 报工单数
FROM (SELECT p.id AS 工单行id, p.pl_no,
             COALESCE(bx.生产批次, CONVERT(varchar(8), p.pl_date, 112)) AS 批次号,
             ISNULL(p.[批次号],N'') AS 报工批次
      FROM dbo.plang p
      CROSS APPLY (SELECT COALESCE(
              NULLIF(LTRIM(RTRIM(p.[批次号])), N''),
              (SELECT TOP 1 NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') FROM dbo.plang_pc pc
                WHERE pc.plang_id = p.id AND ISNULL(pc.asp_cancel,'N') <> 'Y'
                  AND NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') IS NOT NULL ORDER BY pc.id DESC),
              (SELECT TOP 1 NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') FROM dbo.scjl s2
                JOIN dbo.plang_pc pc2 ON pc2.id = s2.gd_id
                WHERE pc2.plang_id = p.id AND ISNULL(s2.asp_cancel,'N') <> 'Y'
                  AND NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') IS NOT NULL ORDER BY s2.id DESC)
          ) AS 生产批次) bx
      WHERE p.id IN (5, 6, 47)) a
JOIN dbo.scjl s ON s.gldh=a.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y'
  AND (EXISTS (SELECT 1 FROM dbo.plang_pc pca WHERE pca.id=s.gd_id AND pca.plang_id=a.工单行id)
       OR (ISNULL(s.gd_id,0)=0 AND (ISNULL(s.[批次号],N'')=ISNULL(a.报工批次,N'')
                                     OR ISNULL(s.[批次号],N'')=N'')))
GROUP BY a.工单行id, s.gxdm
ORDER BY a.工单行id, 工序;

SELECT N'--- ② 最新报工人(同锚) ---' AS x;
SELECT TOP 10 s.gxdm AS 工序, ISNULL(s.ywman,N'') AS 报工人
FROM (SELECT p.id AS 工单行id, p.pl_no,
             COALESCE(bx.生产批次, CONVERT(varchar(8), p.pl_date, 112)) AS 批次号,
             ISNULL(p.[批次号],N'') AS 报工批次
      FROM dbo.plang p
      CROSS APPLY (SELECT COALESCE(
              NULLIF(LTRIM(RTRIM(p.[批次号])), N''),
              (SELECT TOP 1 NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') FROM dbo.plang_pc pc
                WHERE pc.plang_id = p.id AND ISNULL(pc.asp_cancel,'N') <> 'Y'
                  AND NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') IS NOT NULL ORDER BY pc.id DESC),
              (SELECT TOP 1 NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') FROM dbo.scjl s2
                JOIN dbo.plang_pc pc2 ON pc2.id = s2.gd_id
                WHERE pc2.plang_id = p.id AND ISNULL(s2.asp_cancel,'N') <> 'Y'
                  AND NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') IS NOT NULL ORDER BY s2.id DESC)
          ) AS 生产批次) bx
      WHERE p.id = 5) a
JOIN dbo.scjl s ON s.gldh=a.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y'
  AND (EXISTS (SELECT 1 FROM dbo.plang_pc pca WHERE pca.id=s.gd_id AND pca.plang_id=a.工单行id)
       OR (ISNULL(s.gd_id,0)=0 AND (ISNULL(s.[批次号],N'')=ISNULL(a.报工批次,N'')
                                     OR ISNULL(s.[批次号],N'')=N'')))
ORDER BY s.id DESC;

SELECT N'--- ③ 报工记录(最终版) ---' AS x;
SELECT TOP 5 ISNULL(s.[报工单号],N'') AS 报工单号, ISNULL(s.gxdm,N'') AS 工序,
       CONVERT(float, ISNULL(s.sl,0)) AS 报工数量, ISNULL(s.ywman,N'') AS 报工人,
       ISNULL(s.wgzt,N'N') AS 完工状态, CONVERT(varchar(19), s.sc_date, 120) AS 单据日期
FROM dbo.scjl s WHERE s.gldh = N'GD-2026-09-0009' AND ISNULL(s.asp_cancel,'N')<>'Y'
  AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id=s.gd_id AND pc.plang_id=5)
       OR (ISNULL(s.gd_id,0)=0 AND (ISNULL(s.[批次号],N'')=ISNULL(N'20261016',N'')
                                     OR ISNULL(s.[批次号],N'')=N'')))
ORDER BY s.id DESC;

SELECT N'--- ④ HEAD_SELECT 带 LEFT JOIN plang(报工批次)---' AS x;
SELECT c.id AS 卡id, c.卡号, c.大批次号, c.小批次号, ISNULL(c.批次来源,N'') AS 批次来源, c.工单号, c.工单行号, c.工单行id,
       ISNULL(c.产品编码,N'') AS 产品编码, CONVERT(float, ISNULL(c.计划数量,0)) AS 计划数量,
       ISNULL(c.卡状态,N'录入中') AS 卡状态,
       CONVERT(varchar(19), c.asp_time1, 120) AS 创建时间, CONVERT(varchar(19), c.asp_time2, 120) AS 更新时间,
       ISNULL(p.[批次号],N'') AS 报工批次
FROM dbo.wo_proc_card_head c LEFT JOIN dbo.plang p ON p.id = c.工单行id
WHERE ISNULL(c.asp_cancel,'N')<>'Y';

SELECT N'--- ⑤ 挂真实 plang 行时的 HEAD_SELECT(卡片表为空 → 0 行,只验语法)---' AS x;
SELECT TOP 1 c.卡号 FROM dbo.wo_proc_card_head c LEFT JOIN dbo.plang p ON p.id = c.工单行id WHERE 1=0;

