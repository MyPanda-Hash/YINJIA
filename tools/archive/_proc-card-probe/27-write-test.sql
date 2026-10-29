SET NOCOUNT ON;
BEGIN TRAN;

INSERT INTO dbo.wo_proc_card_head (卡号, 大批次号, 小批次号, 批次来源, 工单号, 工单行号, 工单行id,
   产品编码, 产品名称, 规格型号, 计划数量, 生产线, 工艺路线, 卡状态, 备注, asp_user1, asp_time1, asp_cancel)
VALUES (N'LZK-GD-2026-10-0001-1', N'20261016', N'GD-2026-10-0001-1', N'工单日期', N'GD-2026-10-0001', 1, 59,
   N'C-78-10', N'除铅烧结炭棒/滤芯Z045', N'57*30*74.8', 100, N'装箱1(老厂)', N'GY-CB-STD', N'录入中', NULL, N'test', SYSDATETIME(), N'N');
DECLARE @cid bigint = SCOPE_IDENTITY();

INSERT INTO dbo.wo_proc_card_detail (卡id, 卡号, 工序序, 工序, 工序编码, 生产车间, 计划数量,
   计划生产线, 实际生产线, asp_user1, asp_time1, asp_cancel)
VALUES (@cid, N'LZK-GD-2026-10-0001-1', 1, N'成型', N'OP-CX', N'成型', 100, NULL, NULL, N'test', SYSDATETIME(), N'N'),
       (@cid, N'LZK-GD-2026-10-0001-1', 2, N'切炭', N'OP-QT', N'切炭', 100, N'切炭4(X)', NULL, N'test', SYSDATETIME(), N'N'),
       (@cid, N'LZK-GD-2026-10-0001-1', 3, N'组装', N'OP-ZZ', N'组装', 100, NULL, NULL, N'test', SYSDATETIME(), N'N');

SELECT N'--- ① HEAD_SELECT 读回 ---' AS x;
SELECT c.id AS 卡id, c.卡号, c.大批次号, c.小批次号, ISNULL(c.批次来源,N'') AS 批次来源, c.工单号, c.工单行号, c.工单行id,
       ISNULL(c.产品编码,N'') AS 产品编码, ISNULL(c.产品名称,N'') AS 产品名称, ISNULL(c.规格型号,N'') AS 规格型号,
       CONVERT(float, ISNULL(c.计划数量,0)) AS 计划数量, ISNULL(c.生产线,N'') AS 生产线, ISNULL(c.工艺路线,N'') AS 工艺路线,
       ISNULL(c.卡状态,N'录入中') AS 卡状态, ISNULL(c.确认人,N'') AS 确认人,
       CONVERT(varchar(19), c.确认时间, 120) AS 确认时间, ISNULL(c.备注,N'') AS 备注,
       ISNULL(c.asp_user1,N'') AS 创建人, CONVERT(varchar(19), c.asp_time1, 120) AS 创建时间,
       CONVERT(varchar(19), c.asp_time2, 120) AS 更新时间
FROM dbo.wo_proc_card_head c WHERE c.卡号 = N'LZK-GD-2026-10-0001-1';

SELECT N'--- ② 工序行读回 ---' AS x;
SELECT d.id AS 明细id, ISNULL(d.工序序,0) AS 工序序, ISNULL(d.工序,N'') AS 工序, ISNULL(d.工序编码,N'') AS 工序编码,
       ISNULL(d.生产车间,N'') AS 生产车间, CONVERT(float, ISNULL(d.计划数量,0)) AS 计划数量
FROM dbo.wo_proc_card_detail d WHERE d.卡id = @cid AND ISNULL(d.asp_cancel,'N')<>'Y'
ORDER BY ISNULL(d.工序序,999), d.id;

SELECT N'--- ③ 行级报工聚合(该卡对应的工单行)---' AS x;
SELECT a.工单行id AS 行id, s.gxdm AS 工序,
       SUM(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 已报工,
       SUM(CASE WHEN ISNULL(s.wgzt,'N')<>'Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 待审核,
       CONVERT(varchar(19), MAX(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN s.wgsj END),120) AS 完成时间,
       COUNT(*) AS 报工单数
FROM (SELECT p.id AS 工单行id, p.pl_no,
             COALESCE(bx.生产批次, CONVERT(varchar(8), p.pl_date, 112)) AS 批次号
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
      WHERE p.id = 59) a
JOIN dbo.scjl s ON s.gldh=a.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y'
  AND (EXISTS (SELECT 1 FROM dbo.plang_pc pca WHERE pca.id=s.gd_id AND pca.plang_id=a.工单行id)
       OR (ISNULL(s.gd_id,0)=0 AND ISNULL(s.[批次号],N'')=ISNULL(a.批次号,N'')))
GROUP BY a.工单行id, s.gxdm;

SELECT N'--- ④ 自动同步批次 UPDATE ---' AS x;
UPDATE dbo.wo_proc_card_head SET 大批次号=N'20261016', 批次来源=N'生产批次', asp_user2=N'system', asp_time2=SYSDATETIME() WHERE id=@cid;
SELECT 大批次号, 批次来源 FROM dbo.wo_proc_card_head WHERE id=@cid;

SELECT N'--- ⑤ 确认完成 / 撤回 UPDATE ---' AS x;
UPDATE dbo.wo_proc_card_head SET 卡状态=N'已完成', 确认人=N'tester', 确认时间=SYSDATETIME(), asp_user2=N'tester', asp_time2=SYSDATETIME() WHERE id=@cid;
UPDATE dbo.wo_proc_card_head SET 卡状态=N'录入中', 确认人=NULL, 确认时间=NULL, asp_user2=N'tester', asp_time2=SYSDATETIME() WHERE id=@cid;
UPDATE dbo.wo_proc_card_head SET 备注=N'test note', asp_user2=N'tester', asp_time2=SYSDATETIME() WHERE id=@cid;
SELECT 卡状态, ISNULL(确认人,N'(null)') AS 确认人, 备注 FROM dbo.wo_proc_card_head WHERE id=@cid;

SELECT N'--- ⑥ 旧卡软删+复活语句 ---' AS x;
UPDATE dbo.wo_proc_card_detail SET asp_cancel=N'Y', asp_user2=N'tester', asp_time2=SYSDATETIME()
 WHERE 卡id=@cid AND ISNULL(asp_cancel,'N')<>'Y';
UPDATE dbo.wo_proc_card_head SET 大批次号=N'20261016', 小批次号=N'GD-2026-10-0001-1', 批次来源=N'工单日期',
   工单号=N'GD-2026-10-0001', 工单行号=1, 工单行id=59, 产品编码=N'C-78-10', 产品名称=N'除铅烧结炭棒/滤芯Z045',
   规格型号=N'57*30*74.8', 计划数量=100, 生产线=N'装箱1(老厂)', 工艺路线=N'GY-CB-STD',
   卡状态=N'录入中', 确认人=NULL, 确认时间=NULL, 备注=NULL, asp_cancel=N'N', asp_user2=N'tester', asp_time2=SYSDATETIME()
 WHERE id=@cid;
SELECT 卡号, ISNULL(asp_cancel,N'N') AS asp_cancel, 卡状态 FROM dbo.wo_proc_card_head WHERE id=@cid;

SELECT N'--- ⑦ list 查询(带卡) ---' AS x;
SELECT c.卡号, c.大批次号, ISNULL(c.卡状态,N'') AS 卡状态, CONVERT(float, ISNULL(c.计划数量,0)) AS 计划数量
FROM dbo.wo_proc_card_head c
WHERE ISNULL(c.asp_cancel,'N')<>'Y' AND ISNULL(c.大批次号,N'') LIKE N'%20261016%'
ORDER BY c.id DESC OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY;

ROLLBACK TRAN;

SELECT N'--- ⑧ 回滚后行数(应为 0/0)---' AS x,
       (SELECT COUNT(*) FROM dbo.wo_proc_card_head) AS 卡头行数,
       (SELECT COUNT(*) FROM dbo.wo_proc_card_detail) AS 卡明细行数;
