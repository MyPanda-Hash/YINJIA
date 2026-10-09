/* 清理:研发立项→项目进度查询 单路径端到端探针(_e2e-rd-progress-path.cjs)在测试账套造出的单据
   TAG=E2EMV0VP3UF  生成时间=2026-10-09T11:25:02.893Z
   归属判据:① 本次运行显式登记的单据号;② 标记位 立项单 客户名='E2EMV0VP3UF' / 实施计划 项目名称 LIKE 'E2EMV0VP3UF%'
   ⚠ 只对测试账套跑!账套键 YJ_TEST ↔ 库名 HSDZ_MES_TEST(两者不同,别混)。
   ⚠ DbSync 不显示 SELECT 结果,残留检查必须用 sqlcmd:
     sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d HSDZ_MES_TEST -i <本文件> -W -s"|" */
SET NOCOUNT ON;
DECLARE @tagPattern nvarchar(60) = N'E2EMV0VP3UF%';
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT v FROM (VALUES (N'LXA-2026-10-0054'),(N'LXB-2026-10-0008')) AS t(v)
  WHERE v <> N'__none__' AND NOT EXISTS (SELECT 1 FROM @docs d WHERE d.no = t.v);
INSERT INTO @docs (no)
  SELECT x.no FROM (
    SELECT 单据编号 AS no FROM rd_approval WHERE 客户名 LIKE @tagPattern
    UNION SELECT 单据编号 FROM rd_plan WHERE 项目名称 LIKE @tagPattern
  ) x WHERE NOT EXISTS (SELECT 1 FROM @docs d WHERE d.no = x.no);

DECLARE @planCodes TABLE (code nvarchar(120) PRIMARY KEY);
INSERT INTO @planCodes (code)
  SELECT 文档编号 FROM rd_plan WHERE 单据编号 IN (SELECT no FROM @docs) AND ISNULL(文档编号, N'') <> N'';

SELECT N'[删除前] 命中单据数' AS 项, CAST(COUNT(*) AS nvarchar) AS 值 FROM @docs
UNION ALL SELECT N'[删除前] rd_approval',      CAST(COUNT(*) AS nvarchar) FROM rd_approval      WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] rd_plan',          CAST(COUNT(*) AS nvarchar) FROM rd_plan          WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_doc_status',    CAST(COUNT(*) AS nvarchar) FROM yj_doc_status    WHERE doc_no   IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_form_approval', CAST(COUNT(*) AS nvarchar) FROM yj_form_approval WHERE form_no  IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_message',       CAST(COUNT(*) AS nvarchar) FROM yj_message       WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] rd_progress_detail', CAST(COUNT(*) AS nvarchar) FROM rd_progress_detail
  WHERE ISNULL([说明], N'') LIKE @tagPattern OR ISNULL([项目编号], N'') LIKE @tagPattern;

DELETE FROM yj_message       WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval WHERE form_no  IN (SELECT no FROM @docs);
IF OBJECT_ID('yj_doc_modify_log') IS NOT NULL
  DELETE FROM yj_doc_modify_log WHERE doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status    WHERE doc_no   IN (SELECT no FROM @docs);
IF OBJECT_ID('rd_progress_detail') IS NOT NULL
  DELETE FROM rd_progress_detail
   WHERE ISNULL([项目编号], N'') IN (SELECT code FROM @planCodes)
      OR ISNULL([说明], N'')     IN (SELECT code FROM @planCodes)
      OR ISNULL([项目编号], N'') LIKE @tagPattern
      OR ISNULL([说明], N'')     LIKE @tagPattern;
IF OBJECT_ID('rd_approval_detail') IS NOT NULL
  DELETE FROM rd_approval_detail WHERE 单据编号 IN (SELECT no FROM @docs);
IF OBJECT_ID('rd_plan_detail') IS NOT NULL
  DELETE FROM rd_plan_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_approval WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_plan     WHERE 单据编号 IN (SELECT no FROM @docs);
-- ⚠ 不碰号池 s_allno:项目约定「号池只增不删」(_cleanup-probe-junk-20260911.sql 明写"绝不触碰,
--   删了会重发号")。本探针消耗的 2 个号留在台账里,不回收。
--   (另注:该表单据号列名是 dh 而不是 单据编号,写错了只会静默报"列名无效"、删除部分不执行。)

SELECT N'[删除后] 残留单据数' AS 项, CAST(COUNT(*) AS nvarchar) AS 值 FROM (
  SELECT 单据编号 AS no FROM rd_approval WHERE 单据编号 IN (SELECT no FROM @docs)
  UNION ALL SELECT 单据编号 FROM rd_plan WHERE 单据编号 IN (SELECT no FROM @docs)
) z;
