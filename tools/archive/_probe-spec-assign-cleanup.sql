/* _probe-spec-assign-cleanup.sql — 规格书两级分发探针清理(一次性,不登记 db-migrations.txt)
   1) 还原 tester01(原 hash/启用状态)、删 SPECT2、删快照表
   2) 删探针分配行(rd_spec_assign,产品编号 SPA 前缀)
   3) 作废探针的下发记录(rd_dev_task,产品编号 SPA 前缀)
   执行:sqlcmd -f 65001 -S localhost -E -d HSDZ_MES -i tools\_probe-spec-assign-cleanup.sql */
SET NOCOUNT ON;
-- rd_spec_assign 带过滤唯一索引,DML 需 QUOTED_IDENTIFIER ON(否则报 1934)
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
IF OBJECT_ID('dbo._probe_spec_users_bak','U') IS NOT NULL BEGIN
  UPDATE u SET u.password_hash = b.password_hash, u.enabled = b.enabled
    FROM dbo.yj_user u JOIN dbo._probe_spec_users_bak b ON b.username = u.username;
  DROP TABLE dbo._probe_spec_users_bak;
END
GO
DELETE FROM dbo.yj_user WHERE username = 'SPECT2';
GO
DELETE FROM dbo.rd_spec_assign WHERE 产品编号 LIKE N'SPA%';
GO
UPDATE dbo.rd_dev_task SET asp_cancel = 'Y' WHERE 产品编号 LIKE N'SPA%';
GO
PRINT N'探针账号与分配数据已清理';
GO
