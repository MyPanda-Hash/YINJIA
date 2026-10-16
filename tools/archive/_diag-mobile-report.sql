/* _diag-mobile-report.sql — **只读**诊断：手机端报工行能不能被 MES 吸收、吸收后会补什么/切到哪条线
   用法(服务器 RDP 里，本机跑不用对外开端口)：
     sqlcmd -S localhost -d HSDZ_MES -E -i _diag-mobile-report.sql          (Windows 身份)
     或 sqlcmd -S localhost -d HSDZ_MES -U yinjia -P <密码> -i _diag-mobile-report.sql
   把第一行的 @wo 换成要查的工单号（默认 GD-2026-10-0220）再跑；**全程只读，不写任何数据**。 */
SET NOCOUNT ON;
DECLARE @wo sysname = N'GD-2026-10-0220';

PRINT N'===== ① scjl 报工行(手机端直写的行长什么样) =====';
SELECT s.id AS scjl_id, ISNULL(s.gxdm,N'') AS 工序, ISNULL(s.sl,0) AS 数量, ISNULL(s.wgzt,N'') AS 完工状态,
       ISNULL(NULLIF(s.[报工单号],N''),N'(空)') AS 报工单号, ISNULL(s.gd_id,0) AS gd_id,
       ISNULL(s.[工单行号],0) AS 工单行号, ISNULL(NULLIF(s.[批次号],N''),N'(空)') AS 批次号,
       ISNULL(NULLIF(s.scx,N''),N'(空!)') AS 生产线, ISNULL(NULLIF(s.scxmc,N''),N'(空!)') AS 生产线名,
       ISNULL(NULLIF(s.jc_no,N''),N'(空)') AS jc_no, ISNULL(NULLIF(s.post_no,N''),N'(空)') AS 入库单号,
       CONVERT(varchar(19), s.sc_date, 120) AS 报工时间
FROM dbo.scjl s
WHERE s.gldh = @wo AND ISNULL(s.asp_cancel,'N') <> 'Y'
ORDER BY s.id;

PRINT N'===== ② 三级锚定能否定位到**唯一工单行**(吸收第一步) =====';
SELECT s.id AS scjl_id, ISNULL(s.gxdm,N'') AS 工序,
       ISNULL((SELECT TOP 1 CAST(pc.plang_id AS varchar(20)) FROM dbo.plang_pc pc
               JOIN dbo.plang p ON p.id = pc.plang_id AND ISNULL(p.asp_cancel,'N')<>'Y'
               WHERE pc.id = s.gd_id), N'无') AS '①gd_id→工单行id',
       CAST((SELECT COUNT(*) FROM dbo.plang p WHERE p.pl_no = s.gldh
             AND ISNULL(p.pl_xc,0) = ISNULL(s.[工单行号],0) AND ISNULL(s.[工单行号],0) > 0
             AND ISNULL(p.asp_cancel,'N')<>'Y') AS varchar(10)) AS '②工单号+行号 命中数(要=1)',
       CAST((SELECT COUNT(*) FROM dbo.plang p WHERE p.pl_no = s.gldh
             AND ISNULL(p.[批次号],N'') = ISNULL(s.[批次号],N'') AND ISNULL(s.[批次号],N'')<>N''
             AND ISNULL(p.asp_cancel,'N')<>'Y') AS varchar(10)) AS '③工单号+批次 命中数(要=1)'
FROM dbo.scjl s
WHERE s.gldh = @wo AND ISNULL(s.asp_cancel,'N') <> 'Y'
ORDER BY s.id;

PRINT N'===== ③ 工单行现状 + 有没有排产行(能不能补产线/班组/批次) =====';
SELECT p.id AS 工单行id, ISNULL(p.pl_xc,0) AS 工单行号, ISNULL(NULLIF(p.scx,N''),N'(空)') AS 工单行产线,
       ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.xq_sl,0) AS 需求数量, ISNULL(p.rk_sl,0) AS 入库数量,
       ISNULL(p.ja,N'N') AS 结案, ISNULL(NULLIF(p.[当前工序],N''),N'(空)') AS 当前工序,
       ISNULL(p.[当前工序完工量],-1) AS 当前工序完工量, ISNULL(NULLIF(p.[完工状态],N''),N'(空)') AS 完工状态,
       ISNULL(NULLIF(p.[工艺路线],N''),N'(空)') AS 工艺路线, ISNULL(p.[批次号],N'-') AS 批次号,
       CAST((SELECT COUNT(*) FROM dbo.plang_pc pc WHERE pc.plang_id = p.id
             AND ISNULL(pc.asp_cancel,'N')<>'Y') AS varchar(10)) AS 排产行数,
       ISNULL((SELECT TOP 1 ISNULL(NULLIF(pc.scx,N''),N'(空)') FROM dbo.plang_pc pc
               WHERE pc.plang_id = p.id AND ISNULL(pc.asp_cancel,'N')<>'Y'
               ORDER BY CASE WHEN ISNULL(pc.scx,N'')<>N'' THEN 0 ELSE 1 END, pc.id), N'-') AS 排产行产线
FROM dbo.plang p
WHERE p.pl_no = @wo AND ISNULL(p.asp_cancel,'N') <> 'Y'
ORDER BY p.id;

PRINT N'===== ④ 预排台账(转序要切的线在这里；空=只能人工派线) =====';
SELECT 工单行id, 工序序, 工序, ISNULL(状态,N'-') AS 状态,
       ISNULL(NULLIF(计划生产线,N''),N'(空)') AS 计划生产线,
       ISNULL(NULLIF(实际生产线,N''),N'(空)') AS 实际生产线,
       ISNULL(计划数量,0) AS 计划数量, CONVERT(varchar(19), 落实时间, 120) AS 落实时间
FROM dbo.wo_process_line
WHERE 工单号 = @wo AND ISNULL(asp_cancel,'N') <> 'Y'
ORDER BY ISNULL(工序序,999), id;

PRINT N'===== ⑤ 吸收会补的镜像列(目前哪些是空的) =====';
SELECT s.id AS scjl_id,
       CASE WHEN ISNULL(s.scx,N'')=N''  THEN N'缺' ELSE N'有' END AS scx,
       CASE WHEN ISNULL(s.scxmc,N'')=N'' THEN N'缺' ELSE N'有' END AS scxmc,
       CASE WHEN ISNULL(s.wzdm,N'')=N'' THEN N'缺' ELSE N'有' END AS wzdm,
       CASE WHEN ISNULL(s.mc,N'')=N''   THEN N'缺' ELSE N'有' END AS mc,
       CASE WHEN ISNULL(s.jldw,N'')=N'' THEN N'缺' ELSE N'有' END AS jldw,
       CASE WHEN ISNULL(s.pl_sl,0)=0    THEN N'缺' ELSE N'有' END AS pl_sl,
       CASE WHEN ISNULL(s.[工单行号],0)=0 THEN N'缺' ELSE N'有' END AS 工单行号
FROM dbo.scjl s
WHERE s.gldh = @wo AND ISNULL(s.asp_cancel,'N') <> 'Y'
ORDER BY s.id;

PRINT N'===== ⑥ 吸收会不会把它当候选(判据同 CANDIDATE_SQL) =====';
SELECT s.id AS scjl_id,
       CASE WHEN ISNULL(s.wgzt,'N')='Y' AND ISNULL(s.gldh,N'')<>N'' AND ISNULL(s.asp_cancel,'N')<>'Y'
                 AND ISNULL(s.delmark,0)=0
                 AND (ISNULL(s.[报工单号],N'')=N'' OR NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status ds
                        WHERE ds.panel_code=N'WO_REPORT' AND ds.doc_no=s.[报工单号] AND ds.shr IS NOT NULL))
            THEN N'是(候选)' ELSE N'否' END AS 是否候选
FROM dbo.scjl s
WHERE s.gldh = @wo AND ISNULL(s.asp_cancel,'N') <> 'Y'
ORDER BY s.id;
