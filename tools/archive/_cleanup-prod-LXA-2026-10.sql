-- _cleanup-prod-LXA-2026-10.sql
-- 【正式库 HSDZ_MES 专用清理】删除 2026-10-09 误写入正式库的 10 张探针立项单。
--
-- 背景:一次子 agent 探针的登录口径把账套键写错(写成数据库名 HSDZ_MES_TEST 而非账套键 YJ_TEST),
--   DataSourceRouter 对任何非 YJ_TEST 的值静默落到正式库 ⇒ 10 张测试单进了正式库。
--   判据:客户名 = 'MTXMV0S8SS0'、单据编号 = LXA-2026-10-0001..0010、asp_time1 ≈ 2026-10-09 17:48。
--
-- ⚠ 本脚本**故意只给用户执行**,agent 不代跑(项目铁律:正式库的删除类操作只给命令)。
-- ⚠ 双重条件命中(客户名 TAG + 单据号前缀),并且**先 SELECT 数出待删条数**;不是 10 就不要往下跑。
-- ⚠ 未包含 s_allno(发号台账)的 10 行:该表列名未经只读核对,不猜着删。
-- 用法:cd C:\INCER\YINJIA-MES\tools
--   java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar DbSync.java run ..\tools\archive\_cleanup-prod-LXA-2026-10.sql
--   (DbSync 吞 PRINT,看数请把 SELECT 结果落到表里或改用 RAISERROR 版)
SET NOCOUNT ON;
GO
USE HSDZ_MES;
GO

DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no)
  SELECT 单据编号 FROM rd_approval
   WHERE 客户名 = N'MTXMV0S8SS0' AND 单据编号 LIKE N'LXA-2026-10-%';

-- ① 待删条数必须 = 10,否则中止(用 RAISERROR 让 DbSync 把数报出来;severity 16 ⇒ 判失败、不记入 schema_log)
IF (SELECT COUNT(*) FROM @docs) <> 10
BEGIN
  DECLARE @m nvarchar(200) = N'ABORT 待删条数 = ' + CAST((SELECT COUNT(*) FROM @docs) AS nvarchar(10)) + N'(期望 10),未执行任何删除';
  RAISERROR(@m, 16, 1);
END
ELSE
BEGIN
  DELETE FROM yj_message         WHERE 单据编号 IN (SELECT no FROM @docs);
  DELETE FROM yj_form_approval   WHERE panel_code = N'RD_APPROVAL' AND form_no IN (SELECT no FROM @docs);
  DELETE FROM yj_doc_status      WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs);
  DELETE FROM rd_approval_detail WHERE 单据编号 IN (SELECT no FROM @docs);
  DELETE FROM rd_approval        WHERE 单据编号 IN (SELECT no FROM @docs);

  DECLARE @left int = (SELECT COUNT(*) FROM rd_approval WHERE 客户名 = N'MTXMV0S8SS0');
  IF @left <> 0
    RAISERROR(N'FAIL 残留 rd_approval 行数不为 0', 16, 1);
END
GO
