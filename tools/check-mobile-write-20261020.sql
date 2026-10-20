/* ============================================================
   check-mobile-write-20261020.sql —— 手机端报工「写了什么 / 有没有异常回来」只读体检
   （不修改任何数据；随时可跑，也可以挂在服务器上做日常点检）

   背景：手机端小程序/参考库是**直连同一个 SQL Server** 写 scjl(报工行) 和 plang(工单行) 的，
         不经过 MES 接口 ⇒ MES 界面看不到"它调了什么"，只能看它写下的**结果**。
         本脚本把这些结果一次列全。

   用法（服务器 RDP 里）：
     sqlcmd -S localhost -E -d HSDZ_MES -i C:\yinjia\tools\check-mobile-write-20261020.sql
   用法（本机开发库，用 yinjia 账号）：
     cd tools
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run check-mobile-write-20261020.sql
   ============================================================ */
SET NOCOUNT ON;

PRINT N'======== ① 结案异常（页面上那些红标就是它） ========';
SELECT 工单号 = p.pl_no, 工单行号 = ISNULL(p.pl_xc,0), 批次 = ISNULL(p.[批次号],N''),
       客户 = ISNULL(p.khdm,N''), 排产 = ISNULL(p.pl_sl,0), 入库 = ISNULL(p.rk_sl,0),
       ja = ISNULL(p.ja,N''), 生产线 = ISNULL(p.scx,N''),
       最后修改人 = ISNULL(p.asp_user2,N''), 最后修改时间 = CONVERT(varchar(19), p.asp_time2, 120)
  FROM dbo.plang p
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
   AND ISNULL(p.ja,'N') IN (N'T', N'Y')
   AND p.pl_no NOT LIKE N'GD2608%'
   AND NOT (ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0))
 ORDER BY p.pl_no, p.pl_xc;

PRINT N'======== ② 最近 48 小时新建的工单行（谁建的、带什么脏值） ========';
SELECT id, 工单号 = p.pl_no, 工单行号 = ISNULL(p.pl_xc,0), 客户 = ISNULL(p.khdm,N''),
       批次 = CASE WHEN ISNULL(p.[批次号],N'') = N'' THEN N'(空)' ELSE p.[批次号] END,
       生产线 = CASE WHEN ISNULL(p.scx,N'') = N'' THEN N'(空)' ELSE p.scx END,
       排产 = ISNULL(p.pl_sl,0), 入库 = ISNULL(p.rk_sl,0), ja = ISNULL(p.ja,N''),
       建单人 = ISNULL(p.asp_user1,N''), 建单时间 = CONVERT(varchar(19), p.asp_time1, 120)
  FROM dbo.plang p
 WHERE p.asp_time1 >= DATEADD(hour, -48, GETDATE())
   AND ISNULL(p.asp_cancel,'N') <> 'Y'   -- 已作废的不算"新写入"
 ORDER BY p.id DESC;

PRINT N'======== ③ 最近 48 小时的报工行（外部直写的特征：报工单号空 / 产线 0 或空） ========';
SELECT s.id, 工单号 = s.gldh, 工单行号 = ISNULL(s.[工单行号],0), 工序 = ISNULL(s.gxdm,N''),
       数量 = ISNULL(s.sl,0), 报工单号 = CASE WHEN ISNULL(s.[报工单号],N'') = N'' THEN N'(空·外部直写)' ELSE s.[报工单号] END,
       生产线 = CASE WHEN ISNULL(s.scx,N'') IN (N'', N'0') THEN N'(空/0·外部直写)' ELSE s.scx END,
       完工标志 = ISNULL(s.wgzt,N''), 录入人 = ISNULL(s.asp_user1,N''),
       报工时间 = CONVERT(varchar(19), s.sc_date, 120), 录入时间 = CONVERT(varchar(19), s.asp_time1, 120)
  FROM dbo.scjl s
 WHERE ISNULL(s.asp_cancel,'N') <> 'Y'
   AND s.asp_time1 >= DATEADD(hour, -48, GETDATE())
 ORDER BY s.id DESC;

PRINT N'======== ④ 未结案 / 未完工的在册工单行 ========';
SELECT 工单号 = p.pl_no, 工单行号 = ISNULL(p.pl_xc,0), 客户 = ISNULL(p.khdm,N''),
       排产 = ISNULL(p.pl_sl,0), 入库 = ISNULL(p.rk_sl,0),
       生产线 = ISNULL(p.scx,N''), 当前工序 = ISNULL(p.[当前工序],N''),
       完工状态 = ISNULL(p.[完工状态],N''), ja = ISNULL(p.ja,N'')
  FROM dbo.plang p
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
   AND ISNULL(p.ja,'N') NOT IN (N'T', N'Y')
 ORDER BY p.pl_no, p.pl_xc;

PRINT N'======== ⑤ 号池 vs 工单（号池只增不删，末号应等于最大工单号） ========';
SELECT 号池末号 = (SELECT MAX(dh) FROM dbo.s_allno WHERE lb = N'GD' AND ny = CONVERT(varchar(7), GETDATE(), 120)),
       最大工单号 = (SELECT MAX(pl_no) FROM dbo.plang WHERE ISNULL(asp_cancel,'N') <> 'Y' AND pl_no LIKE N'GD%'),
       池里有号但无单 = (SELECT COUNT(*) FROM dbo.s_allno a WHERE a.lb = N'GD'
                        AND a.ny = CONVERT(varchar(7), GETDATE(), 120)
                        AND NOT EXISTS (SELECT 1 FROM dbo.plang p WHERE p.pl_no = a.dh)),
       有单但未登池 = (SELECT COUNT(*) FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
                        AND p.pl_no LIKE N'GD%'
                        AND NOT EXISTS (SELECT 1 FROM dbo.s_allno a WHERE a.dh = p.pl_no));

PRINT N'======== ⑥ 工单号+行号 重复（撞号就查这里） ========';
SELECT 工单号 = pl_no, 工单行号 = ISNULL(pl_xc,0), 行数 = COUNT(*),
       不同客户数 = COUNT(DISTINCT ISNULL(khdm, N''))
  FROM dbo.plang
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
 GROUP BY pl_no, ISNULL(pl_xc,0)
HAVING COUNT(*) > 1
 ORDER BY COUNT(*) DESC;

PRINT N'======== ⑦ 汇总（一行看结论） ========';
SELECT 在册工单行 = (SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N') <> 'Y'),
       结案 = (SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(ja,'N') IN (N'T',N'Y')),
       未结案 = (SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(ja,'N') NOT IN (N'T',N'Y')),
       结案异常 = (SELECT COUNT(*) FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
                  AND ISNULL(p.ja,'N') IN (N'T',N'Y') AND p.pl_no NOT LIKE N'GD2608%'
                  AND NOT (ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0))),
       重复组 = (SELECT COUNT(*) FROM (SELECT pl_no, ISNULL(pl_xc,0) x FROM dbo.plang
                 WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY pl_no, ISNULL(pl_xc,0) HAVING COUNT(*) > 1) d);
