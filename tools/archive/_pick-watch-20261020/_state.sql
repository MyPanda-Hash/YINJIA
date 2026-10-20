/* ============================================================
   _state.sql - 只读体检:领料到底卡在哪一步
   服务器上跑:
     sqlcmd -I -S localhost -E -d HSDZ_MES -f i:65001 -i _state.sql -W
   ---- 看四件事 ----
   ① 最近写进去的流水(小程序只要成功一行,这里就会变)
   ② 今天有没有新流水
   ③ 「工单行 rid 上还压着历史流水」的数量:未解封≈462,解封 20 张后≈442
      (这个数字不动 ⇒ 那条解封命令没执行成功)
   ④ 已搬到 900000000+ 号段的行数:解封后应 = 20
   ============================================================ */
SET NOCOUNT ON;

PRINT '--- ① 最近 10 条出库流水(小程序成功就会出现在这里)---';
SELECT TOP 10 id, src, rid, 单据编号, 物料编码, 批号, 数量,
       CONVERT(varchar(19), asp_time1, 120) AS 写入时间, asp_user1
  FROM dbo.outh ORDER BY id DESC;

PRINT '--- ② 今天(2026-10-20)新增流水 ---';
SELECT COUNT(*) AS 今日新增流失 FROM dbo.outh WHERE asp_time1 >= '2026-10-20'
UNION ALL
SELECT COUNT(*) FROM dbo.inh WHERE asp_time1 >= '2026-10-20';

PRINT '--- ③ 工单行 rid 上仍压着历史流水的数量(未解封≈462 / 解封20张后≈442)---';
SELECT COUNT(*) AS 工单行rid仍有流水
  FROM dbo.outh o JOIN dbo.plang p ON p.id = o.rid
 WHERE o.src = 6;

PRINT '--- ④ 已搬到 900000000+ 号段的流水(解封后应 = 20)---';
SELECT COUNT(*) AS 九百段行数 FROM dbo.outh WHERE src = 6 AND rid >= 900000000;

PRINT '--- ⑤ 这 20 张工单行现在能不能写(事务内插一行,统一回滚)---';
BEGIN TRAN;
BEGIN TRY
  INSERT INTO outh (src, rid, 单据编号, 物料编码, 物料名称, 批号, 数量, asp_user1, asp_time1, asp_cancel)
  VALUES (6, (SELECT TOP 1 id FROM plang ORDER BY id DESC), N'PROBE', N'PROBE-MAT', N'PROBE', N'PROBE-B', 1, N'probe', GETDATE(), 'N');
  SELECT N'[PASS] 该工单行可写(库这层不挡了)' AS 结论;
END TRY
BEGIN CATCH
  SELECT N'[BLOCKED] 仍撞:' + ERROR_MESSAGE() AS 结论;
END CATCH;
ROLLBACK;

PRINT '--- ⑥ 小程序用的登录/权限(有疑虑时看;正常账号应在 db_datareader/db_datawriter)---';
SELECT dp.name AS 数据库用户, dp.type_desc AS 类型,
       ISNULL(STUFF((SELECT ',' + r.name FROM sys.database_role_members m
                       JOIN sys.database_principals r ON r.principal_id = m.role_principal_id
                      WHERE m.member_principal_id = dp.principal_id FOR XML PATH('')), 1, 1, ''), N'') AS 角色,
       dp.create_date AS 建立时间
  FROM sys.database_principals dp
 WHERE dp.type IN ('S','U','G') AND dp.name NOT LIKE '##%'
 ORDER BY dp.name;
