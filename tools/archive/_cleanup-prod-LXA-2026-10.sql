-- _cleanup-prod-LXA-2026-10.sql
-- 【正式库 HSDZ_MES 专用清理】删除 2026-10-09 误写入正式库的 10 张探针立项单。
--
-- 背景:一次子 agent 探针的登录口径把账套键写错(写成数据库名 HSDZ_MES_TEST 而非账套键 YJ_TEST),
--   DataSourceRouter 对任何非 YJ_TEST 的值静默落到正式库 ⇒ 10 张测试单进了正式库。
--
-- ⚠ 本脚本**故意只给用户执行**,agent 不代跑(项目铁律:正式库的删除类操作只给命令)。
--
-- 判据 = 两条同时成立才动:
--   ① 显式白名单:单据编号 ∈ LXA-2026-10-0001 … LXA-2026-10-0010(写死,不做前缀模糊匹配);
--   ② 探针指纹交叉核对:创建时间落在 2026-10-09 17:48:2x,且 客户名 ∈ {空, 'MTXMV0S8SS0'}。
--   ⚠ 2026-10-09 只读核对过的实况(不要凭"客户名=MTXMV0S8SS0"一条判据,那样只命中 6 张):
--       0001-0004 = 探针 A 组建的**空白草稿**:客户名/文档编号为空、创建人分别 admin/cp/glm53/liulei;
--       0005-0010 = B/D/F/G 组:客户名 = 'MTXMV0S8SS0';
--       10 张全部创建于 17:48:22-23、rd_approval_detail 明细行均为 0。
--   条件不满足(白名单缺号、指纹命中 != 10)**一律中止且不做任何删除**。
--
-- ⚠ 未包含 s_allno(发号台账)的 10 行:该表单据号列名是 dh(2026-10-09 已只读核对);
--   这里不删是**按项目约定**「号池只增不删,删了会重发号」(见 _cleanup-probe-junk-20260911.sql)。
--
-- 用法(推荐 sqlcmd:能直接看到下面几条 SELECT 的报数;DbSync 会吞掉 PRINT):
--   sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d HSDZ_MES -C -f 65001 -i tools\archive\_cleanup-prod-LXA-2026-10.sql
SET NOCOUNT ON;
GO
USE HSDZ_MES;
GO

DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) VALUES
 (N'LXA-2026-10-0001'), (N'LXA-2026-10-0002'), (N'LXA-2026-10-0003'), (N'LXA-2026-10-0004'),
 (N'LXA-2026-10-0005'), (N'LXA-2026-10-0006'), (N'LXA-2026-10-0007'), (N'LXA-2026-10-0008'),
 (N'LXA-2026-10-0009'), (N'LXA-2026-10-0010');

-- ① 删除前报数(自证不是空跑)
SELECT N'[删除前] 白名单命中 rd_approval' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值
  FROM rd_approval a JOIN @docs d ON d.no = a.单据编号
UNION ALL SELECT N'[删除前] 其中符合探针指纹', CAST(COUNT(*) AS nvarchar(10))
  FROM rd_approval a JOIN @docs d ON d.no = a.单据编号
 WHERE CONVERT(varchar(19), a.asp_time1, 120) LIKE N'2026-10-09 17:48:%'
   AND ISNULL(a.客户名, N'') IN (N'', N'MTXMV0S8SS0')
UNION ALL SELECT N'[删除前] yj_doc_status', CAST(COUNT(*) AS nvarchar(10))
  FROM yj_doc_status WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_form_approval', CAST(COUNT(*) AS nvarchar(10))
  FROM yj_form_approval WHERE panel_code = N'RD_APPROVAL' AND form_no IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_message', CAST(COUNT(*) AS nvarchar(10))
  FROM yj_message WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] rd_approval_detail', CAST(COUNT(*) AS nvarchar(10))
  FROM rd_approval_detail WHERE 单据编号 IN (SELECT no FROM @docs);

-- ② 闸门:白名单必须 10 张全在,且 10 张全部符合探针指纹;否则中止(不执行任何删除)
DECLARE @miss int = (SELECT COUNT(*) FROM @docs d
                      WHERE NOT EXISTS (SELECT 1 FROM rd_approval a WHERE a.单据编号 = d.no));
DECLARE @fp int = (SELECT COUNT(*) FROM rd_approval a JOIN @docs d ON d.no = a.单据编号
                    WHERE CONVERT(varchar(19), a.asp_time1, 120) LIKE N'2026-10-09 17:48:%'
                      AND ISNULL(a.客户名, N'') IN (N'', N'MTXMV0S8SS0'));
IF @miss <> 0 OR @fp <> 10
BEGIN
  DECLARE @m nvarchar(300) = N'ABORT 白名单缺号 ' + CAST(@miss AS nvarchar(4))
    + N' 张 / 探针指纹命中 ' + CAST(@fp AS nvarchar(4)) + N'/10(期望 0 与 10),未执行任何删除';
  RAISERROR(@m, 16, 1);
END
ELSE
BEGIN
  BEGIN TRAN;
    DELETE FROM yj_message          WHERE 单据编号 IN (SELECT no FROM @docs);
    DELETE FROM yj_form_approval    WHERE panel_code = N'RD_APPROVAL' AND form_no IN (SELECT no FROM @docs);
    DELETE FROM yj_doc_status       WHERE panel_code = N'RD_APPROVAL' AND doc_no  IN (SELECT no FROM @docs);
    DELETE FROM rd_approval_detail  WHERE 单据编号 IN (SELECT no FROM @docs);
    DELETE FROM rd_approval         WHERE 单据编号 IN (SELECT no FROM @docs);
  COMMIT;

  -- ③ 删除后自证:残留必须为 0
  DECLARE @left int = (SELECT COUNT(*) FROM rd_approval a JOIN @docs d ON d.no = a.单据编号);
  SELECT N'[删除后] 残留 rd_approval(应为 0)' AS 项, CAST(@left AS nvarchar(10)) AS 值
  UNION ALL SELECT N'[删除后] 残留 yj_doc_status', CAST(COUNT(*) AS nvarchar(10))
    FROM yj_doc_status WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs);
  IF @left <> 0 RAISERROR(N'FAIL 残留 rd_approval 行数不为 0,请立刻查', 16, 1);
END
GO
