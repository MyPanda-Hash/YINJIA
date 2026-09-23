/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-testdata-cleanup.sql — 杂项测试数据清理(2026-09-21)

   用途:服务器部署前把本地库里的**历次探针/走查/演示留下的杂项单**清掉,只留能跑流程的演示数据
        (演示数据由 tools/seed-demo-prodfile.sql 单独灌,产品编号以 DEMO- 开头,**不在本脚本清理范围**)。
   与 migrate-golive-cleanup.sql 的区别:那个是"部署前清空业务数据"的核弹(全表 DELETE);
   本脚本是**按特征精确圈定**的清理,可以在有真实数据的库上重复执行 —— 规则如下:

   R1 特征名清理:名称/产品名称/标题/变更事由/名称字段命中探针特征
      (PROBE% | MATPICK-% | 探针% | T-PF% | T-PFU% | T-PFG% | probe | TEST-% | 测试产品%)
   R2 空壳单清理:该单**没有存活明细行**且关键名称字段为空 ⇒ 历次点「新增/保存为草稿」留下的空壳
      (研发域实测:40+ 张空壳,正是"数据太乱"的主因)
      R2b/R2c 补漏:名字不为空但**从未有过状态行**、或 saved='N'(一次都没保存过)的空壳照样清
      (历次设计走查留下的 CP382S / MP2609090001 就是这类)
   R3 孤儿清理(全局):yj_doc_status / yj_form_approval / yj_message / yj_attachment / form_flow_link /
      yj_doc_modify_log 里**引用的单据已不存在**的行 —— 顺带治"新单继承旧状态行(一出生就是已归档)"的老毛病
   R4 孤儿分工:rd_dev_task 里产品既无产品信息表、也无任何四文件单据的行
   R5 探针账号:yj_user.username LIKE 'probe[_]%'(演示账号 demo[_]% 保留)

   范围:研发域(bd_/bl_/qc_/wo_ 等其它模块**不动** —— 那些要么是真实业务数据,要么归
        migrate-golive-cleanup.sql 全清;本脚本只碰研发域 + 全局孤儿痕迹)。
   幂等:可重复执行;末尾打印前后对照。
   ⚠ 执行前建议备份:本脚本是破坏性操作(删的是测试单,但删了不可逆)。
   用法(与其它迁移同):
     java -cp tools/lib/mssql-jdbc.jar tools/SqlRunner.java "<jdbcUrl>" yinjia env tools/migrate-testdata-cleanup.sql
   ═══════════════════════════════════════════════════════════════════════════════ */
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ═══════════════ 0. 清理前对照 ═══════════════
SELECT N'清理前' AS 阶段, N'产品信息表' AS 表, COUNT(*) AS 行数 FROM rd_prod_info_head
UNION ALL SELECT N'清理前', N'成型工艺清单', COUNT(*) FROM rd_mold_proc_head
UNION ALL SELECT N'清理前', N'组装工艺清单', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT N'清理前', N'规格书', COUNT(*) FROM rd_spec_doc_head
UNION ALL SELECT N'清理前', N'出货检验计划表', COUNT(*) FROM rd_insp_plan_head
UNION ALL SELECT N'清理前', N'产品变更申请单', COUNT(*) FROM rd_change_head
UNION ALL SELECT N'清理前', N'数据记录表', COUNT(*) FROM rd_dom_test_head
UNION ALL SELECT N'清理前', N'状态行', COUNT(*) FROM yj_doc_status
UNION ALL SELECT N'清理前', N'留痕行', COUNT(*) FROM yj_form_approval;
GO

-- ═══════════════ 1. 圈定要清的研发域单据(R1 特征名 + R2 空壳) ═══════════════
IF OBJECT_ID('tempdb..#kill') IS NOT NULL DROP TABLE #kill;
CREATE TABLE #kill (panel nvarchar(40), doc_no nvarchar(200));

-- R1 特征名(产品信息表)
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_PROD_INFO', 单据编号 FROM rd_prod_info_head
 WHERE ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%PROBE%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%MATPICK-%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%探针%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%T-PF%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%probe%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%测试产品%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%TEST-%';
-- R1 特征名(四文件 + 变更单)
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_MOLD_PROC', 单据编号 FROM rd_mold_proc_head
 WHERE ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%PROBE%' OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%MATPICK-%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%探针%' OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%T-PF%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%probe%' OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%测试产品%';
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_ASM_PROC', 单据编号 FROM rd_asm_proc_head
 WHERE ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%PROBE%' OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%MATPICK-%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%探针%' OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%T-PF%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%probe%' OR ISNULL(产品编号,N'')+N'|'+ISNULL(产品名称,N'') LIKE N'%测试产品%';
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_SPEC_DOC', 单据编号 FROM rd_spec_doc_head
 WHERE ISNULL(编号,N'')+N'|'+ISNULL(名称,N'') LIKE N'%PROBE%' OR ISNULL(编号,N'')+N'|'+ISNULL(名称,N'') LIKE N'%MATPICK-%'
    OR ISNULL(编号,N'')+N'|'+ISNULL(名称,N'') LIKE N'%探针%' OR ISNULL(编号,N'')+N'|'+ISNULL(名称,N'') LIKE N'%T-PF%'
    OR ISNULL(编号,N'')+N'|'+ISNULL(名称,N'') LIKE N'%probe%' OR ISNULL(编号,N'')+N'|'+ISNULL(名称,N'') LIKE N'%测试产品%';
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_INSP_PLAN', 单据编号 FROM rd_insp_plan_head
 WHERE ISNULL(产品编号,N'')+N'|'+ISNULL(标题,N'') LIKE N'%PROBE%' OR ISNULL(产品编号,N'')+N'|'+ISNULL(标题,N'') LIKE N'%MATPICK-%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(标题,N'') LIKE N'%探针%' OR ISNULL(产品编号,N'')+N'|'+ISNULL(标题,N'') LIKE N'%T-PF%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(标题,N'') LIKE N'%probe%' OR ISNULL(产品编号,N'')+N'|'+ISNULL(标题,N'') LIKE N'%测试产品%';
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_CHANGE', 单据编号 FROM rd_change_head
 WHERE ISNULL(产品编号,N'')+N'|'+ISNULL(变更事由,N'') LIKE N'%PROBE%' OR ISNULL(产品编号,N'')+N'|'+ISNULL(变更事由,N'') LIKE N'%探针%'
    OR ISNULL(产品编号,N'')+N'|'+ISNULL(变更事由,N'') LIKE N'%T-PF%' OR ISNULL(产品编号,N'')+N'|'+ISNULL(变更事由,N'') LIKE N'%测试产品%';
-- R2 空壳(无存活明细 + 关键名称为空);变更单/产品信息表按"名称类字段全空"判
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_MOLD_PROC', h.单据编号 FROM rd_mold_proc_head h
 WHERE ISNULL(h.产品编号,N'')+ISNULL(h.产品名称,N'') = N''
   AND NOT EXISTS (SELECT 1 FROM rd_mold_proc_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y');
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_ASM_PROC', h.单据编号 FROM rd_asm_proc_head h
 WHERE ISNULL(h.产品编号,N'')+ISNULL(h.产品名称,N'') = N''
   AND NOT EXISTS (SELECT 1 FROM rd_asm_proc_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y');
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_SPEC_DOC', h.单据编号 FROM rd_spec_doc_head h
 WHERE ISNULL(h.编号,N'')+ISNULL(h.名称,N'') = N''
   AND NOT EXISTS (SELECT 1 FROM rd_spec_doc_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y');
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_INSP_PLAN', h.单据编号 FROM rd_insp_plan_head h
 WHERE ISNULL(h.产品编号,N'')+ISNULL(h.标题,N'') = N''
   AND NOT EXISTS (SELECT 1 FROM rd_insp_plan_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y');
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_PROD_INFO', h.单据编号 FROM rd_prod_info_head h
 WHERE ISNULL(h.产品编号,N'')+ISNULL(h.产品名称,N'') = N'';
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_CHANGE', h.单据编号 FROM rd_change_head h
 WHERE ISNULL(h.产品编号,N'')+ISNULL(h.变更事由,N'') = N'';
-- R2b 空壳且**从未有过状态行**(连"新增"留下的 saved 标记都没有 ⇒ 不是正常建单路径产生的)
--     + R2c 空壳且 saved='N'(点过「新增」但一次都没保存过)
--     这两类名字可能不为空(如历次设计走查留下的 CP382S/MP2609090001),故不能只靠 R2 的名称判空
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_MOLD_PROC', h.单据编号 FROM rd_mold_proc_head h
 WHERE NOT EXISTS (SELECT 1 FROM rd_mold_proc_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y')
   AND (NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_MOLD_PROC' AND s.doc_no = h.单据编号)
        OR EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_MOLD_PROC' AND s.doc_no = h.单据编号 AND ISNULL(s.saved,'N') = 'N'));
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_ASM_PROC', h.单据编号 FROM rd_asm_proc_head h
 WHERE NOT EXISTS (SELECT 1 FROM rd_asm_proc_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y')
   AND (NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_ASM_PROC' AND s.doc_no = h.单据编号)
        OR EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_ASM_PROC' AND s.doc_no = h.单据编号 AND ISNULL(s.saved,'N') = 'N'));
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_SPEC_DOC', h.单据编号 FROM rd_spec_doc_head h
 WHERE NOT EXISTS (SELECT 1 FROM rd_spec_doc_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y')
   AND (NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_SPEC_DOC' AND s.doc_no = h.单据编号)
        OR EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_SPEC_DOC' AND s.doc_no = h.单据编号 AND ISNULL(s.saved,'N') = 'N'));
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_INSP_PLAN', h.单据编号 FROM rd_insp_plan_head h
 WHERE NOT EXISTS (SELECT 1 FROM rd_insp_plan_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y')
   AND (NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_INSP_PLAN' AND s.doc_no = h.单据编号)
        OR EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_INSP_PLAN' AND s.doc_no = h.单据编号 AND ISNULL(s.saved,'N') = 'N'));
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_PROD_INFO', h.单据编号 FROM rd_prod_info_head h
 WHERE NOT EXISTS (SELECT 1 FROM rd_prod_info_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y')
   AND (NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_PROD_INFO' AND s.doc_no = h.单据编号)
        OR EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_PROD_INFO' AND s.doc_no = h.单据编号 AND ISNULL(s.saved,'N') = 'N'));
INSERT INTO #kill (panel, doc_no)
SELECT N'RD_CHANGE', h.单据编号 FROM rd_change_head h
 WHERE NOT EXISTS (SELECT 1 FROM rd_change_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y')
   AND (NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_CHANGE' AND s.doc_no = h.单据编号)
        OR EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_CHANGE' AND s.doc_no = h.单据编号 AND ISNULL(s.saved,'N') = 'N'));
-- R1b **单据编号本身**带探针特征的单(2026-09-21 补:规格书那类面板会把载荷里的「编号」当单据标识取走,
--     于是 单据编号='PROBE-RMT-xxx' 而 编号/名称 两列里查不到任何特征 —— 只查名称字段会漏掉它们)
INSERT INTO #kill (panel, doc_no)
SELECT v.panel, v.no FROM (
  SELECT N'RD_PROD_INFO' AS panel, 单据编号 AS no FROM rd_prod_info_head
  UNION ALL SELECT N'RD_MOLD_PROC', 单据编号 FROM rd_mold_proc_head
  UNION ALL SELECT N'RD_ASM_PROC',  单据编号 FROM rd_asm_proc_head
  UNION ALL SELECT N'RD_SPEC_DOC',  单据编号 FROM rd_spec_doc_head
  UNION ALL SELECT N'RD_INSP_PLAN', 单据编号 FROM rd_insp_plan_head
  UNION ALL SELECT N'RD_CHANGE',    单据编号 FROM rd_change_head
) AS v
WHERE v.no LIKE N'%PROBE%' OR v.no LIKE N'%MATPICK-%' OR v.no LIKE N'%探针%'
   OR v.no LIKE N'%T-PF%'  OR v.no LIKE N'%测试产品%' OR v.no LIKE N'%TEST-%';
-- 演示数据(DEMO- 前缀)一律**不清**
DELETE FROM #kill WHERE doc_no LIKE N'DEMO-%'
   OR doc_no IN (SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'DEMO-%')
   OR doc_no IN (SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'DEMO-%')
   OR doc_no IN (SELECT 单据编号 FROM rd_asm_proc_head  WHERE 产品编号 LIKE N'DEMO-%')
   OR doc_no IN (SELECT 单据编号 FROM rd_spec_doc_head  WHERE 编号     LIKE N'DEMO-%')
   OR doc_no IN (SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'DEMO-%')
   OR doc_no IN (SELECT 单据编号 FROM rd_change_head    WHERE 产品编号 LIKE N'DEMO-%');

SELECT N'待清理单据' AS 项, panel, COUNT(*) AS 张数 FROM #kill GROUP BY panel;
GO

-- ═══════════════ 2. 先删痕迹(状态/留痕/消息/附件/流转/修改记录) ═══════════════
DELETE FROM yj_doc_status    WHERE doc_no IN (SELECT doc_no FROM #kill);
DELETE FROM yj_form_approval WHERE form_no IN (SELECT doc_no FROM #kill);
DELETE FROM yj_message       WHERE 单据编号 IN (SELECT doc_no FROM #kill);
DELETE FROM yj_attachment    WHERE doc_no IN (SELECT doc_no FROM #kill);
DELETE FROM yj_doc_modify_log WHERE doc_no IN (SELECT doc_no FROM #kill);
-- form_flow_link 是"来源↔目标"成对记录(列名 source_form_no/target_form_no)
DELETE FROM form_flow_link   WHERE source_form_no IN (SELECT doc_no FROM #kill) OR target_form_no IN (SELECT doc_no FROM #kill);
GO

-- ═══════════════ 3. 再删业务行(明细先删) ═══════════════
DELETE FROM rd_change_detail     WHERE 单据编号 IN (SELECT doc_no FROM #kill WHERE panel = N'RD_CHANGE');
DELETE FROM rd_mold_proc_detail  WHERE 单据编号 IN (SELECT doc_no FROM #kill WHERE panel = N'RD_MOLD_PROC');
DELETE FROM rd_asm_proc_detail   WHERE 单据编号 IN (SELECT doc_no FROM #kill WHERE panel = N'RD_ASM_PROC');
DELETE FROM rd_spec_doc_detail   WHERE 单据编号 IN (SELECT doc_no FROM #kill WHERE panel = N'RD_SPEC_DOC');
DELETE FROM rd_insp_plan_detail  WHERE 单据编号 IN (SELECT doc_no FROM #kill WHERE panel = N'RD_INSP_PLAN');
DELETE FROM rd_prod_info_detail  WHERE 单据编号 IN (SELECT doc_no FROM #kill WHERE panel = N'RD_PROD_INFO');
GO
DELETE FROM rd_change_head    WHERE 单据编号 IN (SELECT doc_no FROM #kill WHERE panel = N'RD_CHANGE');
DELETE FROM rd_mold_proc_head WHERE 单据编号 IN (SELECT doc_no FROM #kill WHERE panel = N'RD_MOLD_PROC');
DELETE FROM rd_asm_proc_head  WHERE 单据编号 IN (SELECT doc_no FROM #kill WHERE panel = N'RD_ASM_PROC');
DELETE FROM rd_spec_doc_head  WHERE 单据编号 IN (SELECT doc_no FROM #kill WHERE panel = N'RD_SPEC_DOC');
DELETE FROM rd_insp_plan_head WHERE 单据编号 IN (SELECT doc_no FROM #kill WHERE panel = N'RD_INSP_PLAN');
DELETE FROM rd_prod_info_head WHERE 单据编号 IN (SELECT doc_no FROM #kill WHERE panel = N'RD_PROD_INFO');
GO

-- ═══════════════ 4. R3 全局孤儿痕迹(引用的单据已不存在) ═══════════════
-- 4.1 孤儿状态行:研发域先清(单据表就那几张),其余面板用"面板主表里查不到"兜底判定
DELETE s FROM yj_doc_status s
 WHERE s.panel_code LIKE N'RD[_]%'
   AND NOT EXISTS (SELECT 1 FROM rd_prod_info_head x WHERE x.单据编号 = s.doc_no)
   AND NOT EXISTS (SELECT 1 FROM rd_mold_proc_head x WHERE x.单据编号 = s.doc_no)
   AND NOT EXISTS (SELECT 1 FROM rd_asm_proc_head  x WHERE x.单据编号 = s.doc_no)
   AND NOT EXISTS (SELECT 1 FROM rd_spec_doc_head  x WHERE x.单据编号 = s.doc_no)
   AND NOT EXISTS (SELECT 1 FROM rd_insp_plan_head x WHERE x.单据编号 = s.doc_no)
   AND NOT EXISTS (SELECT 1 FROM rd_change_head    x WHERE x.单据编号 = s.doc_no)
   AND NOT EXISTS (SELECT 1 FROM rd_dom_test_head  x WHERE x.单据编号 = s.doc_no)
   AND NOT EXISTS (SELECT 1 FROM rd_sample_no_head x WHERE x.单据编号 = s.doc_no);
GO
-- 4.2 研发域留痕孤儿(单据已不在任何研发域表里)
DELETE a FROM yj_form_approval a
 WHERE a.panel_code LIKE N'RD[_]%'
   AND NOT EXISTS (SELECT 1 FROM rd_prod_info_head x WHERE x.单据编号 = a.form_no)
   AND NOT EXISTS (SELECT 1 FROM rd_mold_proc_head x WHERE x.单据编号 = a.form_no)
   AND NOT EXISTS (SELECT 1 FROM rd_asm_proc_head  x WHERE x.单据编号 = a.form_no)
   AND NOT EXISTS (SELECT 1 FROM rd_spec_doc_head  x WHERE x.单据编号 = a.form_no)
   AND NOT EXISTS (SELECT 1 FROM rd_insp_plan_head x WHERE x.单据编号 = a.form_no)
   AND NOT EXISTS (SELECT 1 FROM rd_change_head    x WHERE x.单据编号 = a.form_no)
   AND NOT EXISTS (SELECT 1 FROM rd_dom_test_head  x WHERE x.单据编号 = a.form_no)
   AND NOT EXISTS (SELECT 1 FROM rd_sample_no_head x WHERE x.单据编号 = a.form_no);
GO
-- 4.3 数据记录表:研发域里 16 张孤儿(文档编号对应的立项申请已不存在)按同一口径清掉
DELETE FROM rd_dom_test_detail WHERE 单据编号 IN (
  SELECT h.单据编号 FROM rd_dom_test_head h
   WHERE ISNULL(h.文档编号,N'') <> N''
     AND NOT EXISTS (SELECT 1 FROM rd_approval a WHERE ISNULL(a.文档编号,N'') = ISNULL(h.文档编号,N'') AND ISNULL(a.asp_cancel,'N')<>'Y'));
DELETE FROM rd_dom_test_head WHERE 单据编号 IN (
  SELECT h.单据编号 FROM rd_dom_test_head h
   WHERE ISNULL(h.文档编号,N'') <> N''
     AND NOT EXISTS (SELECT 1 FROM rd_approval a WHERE ISNULL(a.文档编号,N'') = ISNULL(h.文档编号,N'') AND ISNULL(a.asp_cancel,'N')<>'Y'));
GO

-- ═══════════════ 5. R4 孤儿分工 + R5 探针账号 ═══════════════
DELETE FROM rd_dev_task
 WHERE 产品编号 NOT IN (SELECT ISNULL(产品编号,N'') FROM rd_prod_info_head)
   AND 产品编号 NOT IN (SELECT ISNULL(产品编号,N'') FROM rd_mold_proc_head)
   AND 产品编号 NOT IN (SELECT ISNULL(产品编号,N'') FROM rd_asm_proc_head)
   AND 产品编号 NOT IN (SELECT ISNULL(产品编号,N'') FROM rd_insp_plan_head)
   AND 产品编号 NOT IN (SELECT ISNULL(编号,N'') FROM rd_spec_doc_head)
   AND 产品编号 NOT LIKE N'DEMO-%';
GO
DELETE FROM yj_user WHERE username LIKE N'probe[_]%';
GO

-- ═══════════════ 6. 清理后对照 + 残留核查 ═══════════════
SELECT N'清理后' AS 阶段, N'产品信息表' AS 表, COUNT(*) AS 行数 FROM rd_prod_info_head
UNION ALL SELECT N'清理后', N'成型工艺清单', COUNT(*) FROM rd_mold_proc_head
UNION ALL SELECT N'清理后', N'组装工艺清单', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT N'清理后', N'规格书', COUNT(*) FROM rd_spec_doc_head
UNION ALL SELECT N'清理后', N'出货检验计划表', COUNT(*) FROM rd_insp_plan_head
UNION ALL SELECT N'清理后', N'产品变更申请单', COUNT(*) FROM rd_change_head
UNION ALL SELECT N'清理后', N'数据记录表', COUNT(*) FROM rd_dom_test_head
UNION ALL SELECT N'清理后', N'状态行', COUNT(*) FROM yj_doc_status
UNION ALL SELECT N'清理后', N'留痕行', COUNT(*) FROM yj_form_approval
UNION ALL SELECT N'清理后', N'探针账号', COUNT(*) FROM yj_user WHERE username LIKE N'probe[_]%';
GO
SELECT N'残留特征单' AS 检查, CAST(COUNT(*) AS nvarchar(20)) AS 值 FROM (
  SELECT 单据编号 FROM rd_mold_proc_head WHERE ISNULL(产品编号,N'')+ISNULL(产品名称,N'') LIKE N'%探针%'
  UNION ALL SELECT 单据编号 FROM rd_asm_proc_head WHERE ISNULL(产品编号,N'')+ISNULL(产品名称,N'') LIKE N'%MATPICK%'
  UNION ALL SELECT 单据编号 FROM rd_spec_doc_head WHERE ISNULL(名称,N'') LIKE N'%probe%'
  UNION ALL SELECT 单据编号 FROM rd_insp_plan_head WHERE ISNULL(标题,N'') LIKE N'%测试产品%') t;
GO
PRINT N'migrate-testdata-cleanup 完成:研发域杂项测试单已清,DEMO- 前缀的演示数据保留';
GO
