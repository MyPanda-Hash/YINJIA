/* 清理:研发立项流程矩阵探针(_probe-rd-flow-matrix.cjs)在测试账套造出的单据
   TAG=MTXMV0SHEHC  生成时间=2026-10-09T09:55:04.924Z
   归属判据(两条同时成立才算本探针造的):
     ① 本次运行的显式单据号清单(= @docs 里的 VALUES 部分);
     ② 标记位:立项单 客户名 = 'MTXMV0SHEHC' 或以 MTX 开头、实施计划 项目名称 同理(@tagPattern 扫一遍,
        覆盖本探针的历史运行 —— 该探针每次运行都写自己的 TAG,不会误伤别人)。
   ⚠ 只对测试账套跑!正式库 HSDZ_MES 不受影响(探针硬断言 JWT 账套声明=YJ_TEST 才动手)。
   ⚠ 本脚本刻意不写 USE(DbSync 会拒绝无条件 USE),请显式指定库:
     sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d HSDZ_MES_TEST -i <本文件> -W -s"|"
     (DbSync 不显示 SELECT 结果,残留检查必须用 sqlcmd / SSMS)
   注:此处 HSDZ_MES_TEST 是**数据库名**;接口侧的账套键是 YJ_TEST,两者不同,别混。 */
SET NOCOUNT ON;
DECLARE @tagPattern nvarchar(60) = N'MTX%';
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
-- ① 本次运行的显式清单
INSERT INTO @docs (no)
  SELECT v FROM (VALUES (N'LXA-2026-10-0042'),(N'LXA-2026-10-0043'),(N'LXA-2026-10-0044'),(N'LXA-2026-10-0045'),(N'LXA-2026-10-0046'),(N'LXA-2026-10-0047'),(N'LXA-2026-10-0048'),(N'LXA-2026-10-0049'),(N'LXA-2026-10-0050'),(N'LXA-2026-10-0051'),(N'LXB-2026-10-0006'),(N'LXA-2026-10-0052')) AS t(v)
  WHERE v <> N'__none__' AND NOT EXISTS (SELECT 1 FROM @docs d WHERE d.no = t.v);
-- ② 标记位扫描(覆盖历史运行;去重,否则与 ① 撞主键)
INSERT INTO @docs (no)
  SELECT x.no FROM (
    SELECT 单据编号 AS no FROM rd_approval WHERE 客户名 LIKE @tagPattern
    UNION SELECT 单据编号 FROM rd_plan WHERE 项目名称 LIKE @tagPattern
  ) x WHERE NOT EXISTS (SELECT 1 FROM @docs d WHERE d.no = x.no);

-- ③ 项目实施计划的**业务文档编号**(进度查询里的 说明/项目编号 存的是它,不是单据编号)
DECLARE @planCodes TABLE (code nvarchar(120) PRIMARY KEY);
INSERT INTO @planCodes (code)
  SELECT 文档编号 FROM rd_plan WHERE 单据编号 IN (SELECT no FROM @docs) AND ISNULL(文档编号, N'') <> N'';

-- 删除前:先报出"将要动几条"(自证不是空跑)
SELECT N'[删除前] 命中单据数' AS 项, CAST(COUNT(*) AS nvarchar) AS 值 FROM @docs
UNION ALL SELECT N'[删除前] rd_approval', CAST(COUNT(*) AS nvarchar) FROM rd_approval WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] rd_plan', CAST(COUNT(*) AS nvarchar) FROM rd_plan WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_doc_status', CAST(COUNT(*) AS nvarchar) FROM yj_doc_status WHERE doc_no IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_form_approval', CAST(COUNT(*) AS nvarchar) FROM yj_form_approval WHERE form_no IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_message', CAST(COUNT(*) AS nvarchar) FROM yj_message WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] rd_progress_detail(计划同步行)', CAST(COUNT(*) AS nvarchar) FROM rd_progress_detail WHERE ISNULL([说明], N'') IN (SELECT no FROM @docs) OR ISNULL([说明], N'') LIKE @tagPattern;

-- 单据级留痕(顺序:消息 → 审批留痕 → 修改日志 → 状态)
DELETE FROM yj_message         WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval   WHERE form_no IN (SELECT no FROM @docs);
IF OBJECT_ID('yj_doc_modify_log') IS NOT NULL
  DELETE FROM yj_doc_modify_log WHERE doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status      WHERE doc_no IN (SELECT no FROM @docs);

-- 项目进度查询里由本次计划同步出来的行(说明/项目编号 = RD_PLAN.文档编号)
IF OBJECT_ID('rd_progress_detail') IS NOT NULL
  DELETE FROM rd_progress_detail WHERE ISNULL([说明], N'') IN (SELECT code FROM @planCodes);
IF OBJECT_ID('rd_progress_detail') IS NOT NULL
  DELETE FROM rd_progress_detail WHERE ISNULL([项目编号], N'') IN (SELECT code FROM @planCodes);
-- 兜底:历史运行的计划单已被删掉、@planCodes 取不到时,用标记位直接扫(说明里存的就是 MTX…-PLANn)
IF OBJECT_ID('rd_progress_detail') IS NOT NULL
  DELETE FROM rd_progress_detail WHERE ISNULL([说明], N'') LIKE @tagPattern OR ISNULL([项目编号], N'') LIKE @tagPattern;

-- 业务表
IF OBJECT_ID('rd_approval_detail') IS NOT NULL
  DELETE FROM rd_approval_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_approval WHERE 单据编号 IN (SELECT no FROM @docs);
IF OBJECT_ID('rd_plan_detail') IS NOT NULL
  DELETE FROM rd_plan_detail WHERE 单据编号 IN (SELECT no FROM @docs);
IF OBJECT_ID('rd_plan') IS NOT NULL
  DELETE FROM rd_plan WHERE 单据编号 IN (SELECT no FROM @docs);

-- 残留检查(应全为 0);对照组:按同一判据查一个必然不存在的号,必须为 0
SELECT N'[残留] rd_approval' AS 项, CAST(COUNT(*) AS nvarchar) AS 值 FROM rd_approval WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[残留] rd_plan', CAST(COUNT(*) AS nvarchar) FROM rd_plan WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[残留] yj_doc_status', CAST(COUNT(*) AS nvarchar) FROM yj_doc_status WHERE doc_no IN (SELECT no FROM @docs)
UNION ALL SELECT N'[残留] yj_form_approval', CAST(COUNT(*) AS nvarchar) FROM yj_form_approval WHERE form_no IN (SELECT no FROM @docs)
UNION ALL SELECT N'[残留] yj_message', CAST(COUNT(*) AS nvarchar) FROM yj_message WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[残留] rd_progress_detail', CAST(COUNT(*) AS nvarchar) FROM rd_progress_detail WHERE ISNULL([说明], N'') IN (SELECT code FROM @planCodes) OR ISNULL([项目编号], N'') IN (SELECT code FROM @planCodes)
UNION ALL SELECT N'[残留] rd_progress_detail(标记位扫)', CAST(COUNT(*) AS nvarchar) FROM rd_progress_detail WHERE ISNULL([说明], N'') LIKE @tagPattern OR ISNULL([项目编号], N'') LIKE @tagPattern
UNION ALL SELECT N'[残留] 按标记位再扫 rd_approval', CAST(COUNT(*) AS nvarchar) FROM rd_approval WHERE 客户名 LIKE @tagPattern
UNION ALL SELECT N'[残留] 按标记位再扫 rd_plan', CAST(COUNT(*) AS nvarchar) FROM rd_plan WHERE 项目名称 LIKE @tagPattern
UNION ALL SELECT N'[对照组] 必然不存在的号 __NEVER__', CAST(COUNT(*) AS nvarchar) FROM rd_approval WHERE 单据编号 = N'__NEVER__';
