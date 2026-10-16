/* _probe-wo0220-report.sql — 只读：GD-2026-10-0220 的报工/排产/工单现状(手机端报工产生) */
SET NOCOUNT ON;

SELECT '== scjl 行(该工单) ==' AS section;
SELECT CAST(s.id AS varchar(10)) + ' | 报工单号=' + ISNULL(s.报工单号,'(空)') + ' | gxdm=' + ISNULL(s.gxdm,'(空)')
       + ' | sl=' + CAST(ISNULL(s.sl,0) AS varchar(20)) + ' | wgzt=' + ISNULL(s.wgzt,'(空)')
       + ' | gd_id=' + CAST(ISNULL(s.gd_id,0) AS varchar(10)) + ' | 工单行号=' + CAST(ISNULL(s.[工单行号],-1) AS varchar(10))
       + ' | 批次号=' + ISNULL(s.[批次号],'(空)') + ' | scx=' + ISNULL(s.scx,'(空)') + ' | scxmc=' + ISNULL(s.scxmc,'(空)')
       + ' | 生产线? ' + CASE WHEN ISNULL(s.scx,N'')=N'' THEN '空!' ELSE '有' END
       + ' | sc_date=' + ISNULL(CONVERT(varchar(19),s.sc_date,120),'-')
       + ' | wgsj=' + ISNULL(CONVERT(varchar(19),s.wgsj,120),'-')
       + ' | asp_user1=' + ISNULL(s.asp_user1,'-') + ' | delmark=' + CAST(ISNULL(s.delmark,-1) AS varchar(5))
       + ' | asp_cancel=' + ISNULL(s.asp_cancel,'-')
       + ' | pl_sl=' + CAST(ISNULL(s.pl_sl,0) AS varchar(20)) + ' | jbbh=' + ISNULL(s.jbbh,'(空)')
       + ' | post_no=' + ISNULL(s.post_no,'(空)') + ' | jc_no=' + ISNULL(s.jc_no,'(空)') AS row
FROM dbo.scjl s WHERE s.gldh = 'GD-2026-10-0220' ORDER BY s.id;

SELECT '== scjl 该工单按期汇总(仅已完工未作废) ==' AS section;
SELECT 'gxdm=' + ISNULL(gxdm,'(空)') + ' 行数=' + CAST(COUNT(*) AS varchar(10))
       + ' Σsl=' + CAST(ISNULL(SUM(sl),0) AS varchar(20)) AS row
FROM dbo.scjl WHERE gldh='GD-2026-10-0220' AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(delmark,0)=0
GROUP BY gxdm;

SELECT '== plang 行(该工单) ==' AS section;
SELECT CAST(id AS varchar(10)) + ' | xc=' + CAST(ISNULL(pl_xc,0) AS varchar(10)) + ' | 批次号=' + ISNULL([批次号],'-')
       + ' | 需求xq_sl=' + CAST(ISNULL(xq_sl,0) AS varchar(20)) + ' | 排产pl_sl=' + CAST(ISNULL(pl_sl,0) AS varchar(20))
       + ' | 入库rk_sl=' + CAST(ISNULL(rk_sl,0) AS varchar(20)) + ' | ja=' + ISNULL(ja,'-')
       + ' | 工艺路线=' + ISNULL([工艺路线],'(空)') + ' | 当前工序=' + ISNULL(当前工序,'(空)')
       + ' | 当前工序完工量=' + CAST(ISNULL([当前工序完工量],-1) AS varchar(20))
       + ' | 完工状态=' + ISNULL(完工状态,'(空)') + ' | scx=' + ISNULL(scx,'(空)')
       + ' | 生产数量=' + CAST(ISNULL(生产数量,-1) AS varchar(20)) + ' | 单位换算率=' + CAST(ISNULL([单位换算率],-1) AS varchar(20)) AS row
FROM dbo.plang WHERE pl_no='GD-2026-10-0220' ORDER BY id;

SELECT '== plang_pc 行(该工单) ==' AS section;
SELECT CAST(pc.id AS varchar(10)) + ' | plang_id=' + CAST(ISNULL(pc.plang_id,-1) AS varchar(10))
       + ' | 命中 plang? ' + CASE WHEN EXISTS(SELECT 1 FROM dbo.plang p WHERE p.id=pc.plang_id) THEN 'Y' ELSE 'N(悬空)' END
       + ' | xc=' + CAST(ISNULL(pc.pl_xc,0) AS varchar(10)) + ' | 批次号=' + ISNULL(pc.[批次号],'-')
       + ' | scx=' + ISNULL(pc.scx,'(空)') + ' | lb=' + ISNULL(pc.lb,'(空)')
       + ' | pl_sl=' + CAST(ISNULL(pc.pl_sl,0) AS varchar(20)) + ' | asp_user1=' + ISNULL(pc.asp_user1,'-')
       + ' | pl_date=' + ISNULL(CONVERT(varchar(19),pc.pl_date,120),'-') AS row
FROM dbo.plang_pc pc WHERE pc.pl_no='GD-2026-10-0220' ORDER BY pc.id;

SELECT '== wo_progress 行(该工单) ==' AS section;
SELECT STUFF((SELECT ' || ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.wo_progress') FOR XML PATH(''), TYPE).value('.','nvarchar(max)'),1,4,'') AS cols;

SELECT '== yj_usage_log 列 ==' AS section;
SELECT STUFF((SELECT ', ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.yj_usage_log') FOR XML PATH(''), TYPE).value('.','nvarchar(max)'),1,2,'') AS cols;

SELECT '== yj_usage_log 该工单最近 10 条 ==' AS section;
SELECT TOP 10 * FROM dbo.yj_usage_log WHERE doc_no LIKE '%GD-2026-10-0220%' ORDER BY created_at DESC;
