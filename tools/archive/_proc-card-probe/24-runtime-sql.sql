SET NOCOUNT ON;

SELECT N'--- ① list 主查询(含 OFFSET/FETCH;暂无卡,应为 0 行)---' AS x;
SELECT c.id AS 卡id, c.卡号, c.大批次号, c.小批次号, ISNULL(c.批次来源,N'') AS 批次来源, c.工单号, c.工单行号, c.工单行id,
       ISNULL(c.产品编码,N'') AS 产品编码, ISNULL(c.产品名称,N'') AS 产品名称, ISNULL(c.规格型号,N'') AS 规格型号,
       CONVERT(float, ISNULL(c.计划数量,0)) AS 计划数量, ISNULL(c.生产线,N'') AS 生产线, ISNULL(c.工艺路线,N'') AS 工艺路线,
       ISNULL(c.卡状态,N'录入中') AS 卡状态, ISNULL(c.确认人,N'') AS 确认人,
       CONVERT(varchar(19), c.确认时间, 120) AS 确认时间, ISNULL(c.备注,N'') AS 备注,
       ISNULL(c.asp_user1,N'') AS 创建人, CONVERT(varchar(19), c.asp_time1, 120) AS 创建时间,
       CONVERT(varchar(19), c.asp_time2, 120) AS 更新时间
FROM dbo.wo_proc_card_head c
WHERE ISNULL(c.asp_cancel,'N')<>'Y'
  AND ISNULL(c.产品编码,N'') LIKE N'%C-78%'
  AND ISNULL(c.卡状态,N'') = N'录入中'
  AND c.asp_time1 >= '2026-10-01'
  AND c.asp_time1 < DATEADD(day, 1, '2026-10-31')
ORDER BY c.id DESC OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY;

SELECT N'--- ② list 总数 ---' AS x;
SELECT COUNT(*) AS 总行数 FROM dbo.wo_proc_card_head c WHERE ISNULL(c.asp_cancel,'N')<>'Y';

SELECT N'--- ③ lines():某解析批次的工单行(以 20261019 为例)---' AS x;
SELECT p.id AS 工单行id, p.pl_no AS 工单号, p.pl_xc AS 工单行号,
       ISNULL(p.dm,N'') AS 产品编码, ISNULL(p.mc,N'') AS 产品名称, ISNULL(p.gg,N'') AS 规格型号,
       CONVERT(float, ISNULL(p.pl_sl,0)) AS 计划数量, ISNULL(p.scx,N'') AS 生产线,
       ISNULL(p.[当前工序],N'') AS 当前工序, ISNULL(p.[完工状态],N'') AS 完工状态,
       ISNULL(c.卡号,N'') AS 卡号, ISNULL(c.卡状态,N'') AS 卡状态
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
LEFT JOIN dbo.wo_proc_card_head c ON c.工单行id = p.id AND ISNULL(c.asp_cancel,'N')<>'Y'
WHERE ISNULL(p.asp_cancel,'N')<>'Y'
  AND COALESCE(bx.生产批次, CONVERT(varchar(8), p.pl_date, 112)) = N'20261019'
  AND (p.pl_no LIKE N'%GD-2026-10-0018%' OR ISNULL(p.dm,N'') LIKE N'%GD-2026-10-0018%'
       OR ISNULL(p.mc,N'') LIKE N'%GD-2026-10-0018%' OR ISNULL(p.gg,N'') LIKE N'%GD-2026-10-0018%')
ORDER BY p.pl_no, ISNULL(p.pl_xc,0), p.id;

SELECT N'--- ④ 照片分组(field_key→工序序) ---' AS x;
SELECT doc_no AS 卡号, ISNULL(field_key,N'') AS 字段键, COUNT(*) AS 张数
FROM dbo.yj_attachment WHERE panel_code = 'PROC_FLOW_CARD' AND doc_no IN (N'LZK-X')
GROUP BY doc_no, field_key;

SELECT N'--- ⑤ 报工记录(按行锚) ---' AS x;
SELECT TOP 5 ISNULL(s.[报工单号],N'') AS 报工单号, ISNULL(s.gxdm,N'') AS 工序,
       CONVERT(float, ISNULL(s.sl,0)) AS 报工数量, ISNULL(s.ywman,N'') AS 报工人,
       ISNULL(s.wgzt,N'N') AS 完工状态, CONVERT(varchar(19), s.sc_date, 120) AS 单据日期
FROM dbo.scjl s WHERE s.gldh = N'GD-2026-09-0009' AND ISNULL(s.asp_cancel,'N')<>'Y'
  AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = 5)
       OR (ISNULL(s.gd_id,0) = 0 AND ISNULL(s.[批次号],N'') = ISNULL(N'20260918', N'')))
ORDER BY s.id DESC;

SELECT N'--- ⑥ 卡头视图无行时(0 行)---' AS x;
SELECT TOP 1 c.卡号 FROM dbo.wo_proc_card_head c WHERE 1 = 0;
