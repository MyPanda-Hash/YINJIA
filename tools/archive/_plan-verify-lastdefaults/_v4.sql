SET NOCOUNT ON;
-- H) 冷读#2:各道台账覆盖物料数,带/不带 plang.asp_cancel 过滤对照(正式口径=带)
SELECT
 (SELECT COUNT(DISTINCT p.dm) FROM dbo.wo_process_line wl JOIN dbo.plang p ON p.id=wl.工单行id
   WHERE ISNULL(wl.asp_cancel,'N')<>'Y' AND COALESCE(NULLIF(wl.实际生产线,N''), wl.计划生产线, N'')<>N'') AS 不带过滤物料数,
 (SELECT COUNT(DISTINCT p.dm) FROM dbo.wo_process_line wl JOIN dbo.plang p ON p.id=wl.工单行id
   WHERE ISNULL(wl.asp_cancel,'N')<>'Y' AND ISNULL(p.asp_cancel,'N')<>'Y'
     AND COALESCE(NULLIF(wl.实际生产线,N''), wl.计划生产线, N'')<>N'') AS 正式口径物料数,
 (SELECT COUNT(DISTINCT p.dm + N'|' + wl.工序) FROM dbo.wo_process_line wl JOIN dbo.plang p ON p.id=wl.工单行id
   WHERE ISNULL(wl.asp_cancel,'N')<>'Y' AND ISNULL(p.asp_cancel,'N')<>'Y'
     AND COALESCE(NULLIF(wl.实际生产线,N''), wl.计划生产线, N'')<>N'') AS 正式口径物料x工序数,
 (SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N')='Y') AS plang作废行数;
-- I) 冷读#5:plang_pc.asp_time1 批量回填污染度(同一分钟占比)
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN CONVERT(varchar(16), asp_time1, 120) = '2026-10-18 07:46' THEN 1 ELSE 0 END) AS 同分钟行,
       SUM(CASE WHEN plang_id IS NULL OR plang_id = 0 THEN 1 ELSE 0 END) AS plang_id空行
FROM dbo.plang_pc;
