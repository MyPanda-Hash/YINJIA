/* _probe-absorb-state.sql — 只读：吸收(手机端报工)前后状态取证 */
SET NOCOUNT ON;
DECLARE @wo sysname = N'GD-TEST-ABSORB-01';

SELECT '== ① scjl 报工行(镜像补了没) ==' AS section;
SELECT CAST(s.id AS varchar(10)) + ' | 报工单号=' + ISNULL(NULLIF(s.[报工单号],N''),N'(空)')
       + ' | gxdm=' + ISNULL(s.gxdm,N'(空)') + ' | sl=' + CAST(ISNULL(s.sl,0) AS varchar(20))
       + ' | wgzt=' + ISNULL(s.wgzt,N'(空)')
       + ' | gd_id=' + CAST(ISNULL(s.gd_id,0) AS varchar(10))
       + ' | 工单行号=' + CAST(ISNULL(s.[工单行号],0) AS varchar(10))
       + ' | 批次号=' + ISNULL(NULLIF(s.[批次号],N''),N'(空)')
       + ' | scx=' + ISNULL(NULLIF(s.scx,N''),N'(空!)')
       + ' | scxmc=' + ISNULL(NULLIF(s.scxmc,N''),N'(空!)')
       + ' | wzdm=' + ISNULL(NULLIF(s.wzdm,N''),N'(空!)')
       + ' | mc=' + ISNULL(NULLIF(s.mc,N''),N'(空!)')
       + ' | jldw=' + ISNULL(NULLIF(s.jldw,N''),N'(空!)')
       + ' | pl_sl=' + CAST(ISNULL(s.pl_sl,0) AS varchar(20))
       + ' | asp_user2=' + ISNULL(NULLIF(s.asp_user2,N''),N'(未吸收)') AS row
FROM dbo.scjl s WHERE s.gldh = @wo ORDER BY s.id;

SELECT '== ② plang 工单行(状态推进了没) ==' AS section;
SELECT CAST(id AS varchar(10)) + ' | scx=' + ISNULL(NULLIF(scx,N''),N'(空)')
       + ' | 当前工序=' + ISNULL(NULLIF(当前工序,N''),N'(空)')
       + ' | 当前工序完工量=' + CAST(ISNULL([当前工序完工量],-1) AS varchar(20))
       + ' | 完工状态=' + ISNULL(NULLIF(完工状态,N''),N'(空)')
       + ' | 完工时间=' + ISNULL(CONVERT(varchar(19),完工时间,120),N'(空)')
       + ' | ja=' + ISNULL(ja,N'-') AS row
FROM dbo.plang WHERE pl_no = @wo ORDER BY id;

SELECT '== ③ plang_pc 排产行(转序切线了没) ==' AS section;
SELECT CAST(id AS varchar(10)) + ' | plang_id=' + CAST(ISNULL(plang_id,-1) AS varchar(10))
       + ' | scx=' + ISNULL(NULLIF(scx,N''),N'(空)') + ' | 批次号=' + ISNULL([批次号],N'-') AS row
FROM dbo.plang_pc WHERE pl_no = @wo ORDER BY id;

SELECT '== ④ 预排台账(下一道是否被落实) ==' AS section;
SELECT CAST(工序序 AS varchar(10)) + ' ' + ISNULL(工序,N'-') + ' | 状态=' + ISNULL(状态,N'-')
       + ' | 计划线=' + ISNULL(NULLIF(计划生产线,N''),N'(空)')
       + ' | 实际线=' + ISNULL(NULLIF(实际生产线,N''),N'(空)')
       + ' | 计划数量=' + CAST(ISNULL(计划数量,0) AS varchar(20))
       + ' | 落实时间=' + ISNULL(CONVERT(varchar(19),落实时间,120),N'-') AS row
FROM dbo.wo_process_line WHERE 工单号 = @wo ORDER BY ISNULL(工序序,999), id;

SELECT '== ⑤ 转序轨迹 wo_transfer_log ==' AS section;
SELECT CONVERT(varchar(19), asp_time1, 120) + ' | ' + ISNULL(从生产线,N'-') + ' → ' + ISNULL(到生产线,N'-')
       + ' | 数量=' + CAST(ISNULL(数量,0) AS varchar(20)) + ' | 原因=' + ISNULL(原因,N'-')
       + ' | plang_id=' + CAST(ISNULL(plang_id,-1) AS varchar(10)) AS row
FROM dbo.wo_transfer_log WHERE pl_no = @wo ORDER BY id;
