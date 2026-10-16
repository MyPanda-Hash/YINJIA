-- migrate-drop-manu-order-report-panels-20261017.sql
--   —— 下架「生产工单明细表 MANU_ORDER_DETAIL / 生产工单统计表 MANU_ORDER_STATS」2 张报表面板
--
-- 用户口径(2026-10-17):「完成上面的任务后检查当前生产工单明细标和生产工单统计表,查看当前这两个表是否
--   没有作用,不存在作用的话删除掉就可以,帮我查看一下。」
--
-- ══════ 为什么判定它们「没有作用」(取证见下,全部是 2026-10-17 实测)══════
--   ① **数据面:正式库里它们永远是空的**。两张都是 `flat`(报表)面板,载体是视图:
--        v_manu_order_detail / v_manu_order_stats ← bd_manu_order + bl_manu_order(经典遗留那一对)
--      正式库 HSDZ_MES:bd_manu_order **0 行**、bl_manu_order **0 行** ⇒ 两个视图 **0 行** ⇒ 打开就是空表。
--      真实生产工单走的是 `plang`(429 行)+ 订单结转 + 自建工单列表页(/prod/plan/workOrderList),
--      与这对遗留表**无关**(该结论早在 docs/design/MES与WMS流程梳理.md §B 就写明:"bd_manu_order 0 行")。
--      测试库 HSDZ_MES_TEST 里视图有 21/11 行,那是**快照遗留的演示数据**,不是业务产出。
--   ② **使用面:一次都没被打开过**。yj_usage_log 全库 7633 行(测试库 3704 行),
--      panel_name 精确匹配「生产工单明细表/生产工单统计表」= **0 行**;
--      放宽到「%明细表%/%统计表%」= **0 行** ⇒ 这一类报表面板整体从未有人用过。
--      (同一日志里「生产工单」有 51 行,说明日志本身是活的、覆盖到生产域的。)
--   ③ **代码面:后端零引用**。backend/src/main/java 全仓 grep `MANU_ORDER_DETAIL|MANU_ORDER_STATS|v_manu_order`
--      = **0 处**(面板是元数据驱动的,没有专属 handler/controller/service)。
--   ④ **依赖面:没有第四方用这两个视图**。sys.sql_expression_dependencies 里引用它们的主体 = 0
--      (视图/过程/函数都没有);无外键;无报表模板;yj_document 家族表(附件/审批/状态/修改记录/标注/
--      字段绑定/列设置/计划条款)对这 2 个 panel_code 命中 **0 行**。
--   ⑤ 菜单外唯一两处引用在**前端常量**里(随本批同批清理):
--        frontend/src/business/menus.js(菜单项本身,生产计划组)
--        frontend/src/views/scm/BusinessOverview.vue(生产制造「报表」清单的两条)
--      + 一条菜单单测 frontend/src/business/menus.test.js 的期望数组。
--   ⑥ 判据不是"面板能不能开" —— 能开(列表接口 200),但**开了也没内容、也没人开、也没有下游**。
--
-- ⚠ 与 2026-10-16 下架成型/切炭检验单那批(v3.26)性质**不同**:那批是**带数据删业务表**;
--   本批**只删视图与面板元数据**,一张物理表都不动(保留 bd_manu_order/bl_manu_order —— 它们仍被
--   MANU_ORDER 面板的保存/审批处理器 ManuCloseHandler/ManuFirstArticleHandler/ManuPurchaseReqHandler/
--   ManuSplitHandler 引用,且登记在 tools/db-inuse-tables.txt 在册台账里)。
--   被删的 2 个视图**没有**登记在 db-inuse-tables.txt(那份台账登记的是**表**),故台账不动。
--
-- ══════ 逐个列明删了什么 ══════
--   视图 2 个       : v_manu_order_detail(70 列) / v_manu_order_stats(11 列)
--   yj_panel        : 2 行(MANU_ORDER_DETAIL / MANU_ORDER_STATS)
--   yj_field        : 34 行(25 + 9)
--   yj_role_panel   : 6 行(3 + 3)
--   yj_translation  : 面板名译名 **18 行**(2 个面板名 × 9 语言;守卫:仅当已无任何 yj_panel 用该名字时才删)
--   其它一律不动    : yj_usage_log(审计流水,本就没这两张的记录)、s_allno(无发号痕迹)、
--                     bd_manu_order / bl_manu_order(物理表保留)
--   两账套同一现状  : 上述行数在 HSDZ_MES 与 HSDZ_MES_TEST 上**完全一致**(实测)
--
-- ══════ 回退抓手 ══════
--   tools/archive/_manu-order-report-panels-20261017/
--     restore-prod.sql / restore-test.sql —— 把 #p 清单里那段「视图定义 + 面板 + 34 字段 + 6 授权 + 译名」
--     原样插回(视图定义取自 sys.sql_modules 实测文本,不是手抄)。
--   回退顺序:先跑 restore-*.sql,再回滚本提交的前端改动(menus.js/menus.test.js/BusinessOverview.vue)。
--
-- 幂等:每步带存在性守卫,重跑为 no-op(DbSync 按内容哈希可能重跑)。
-- 两账套都要执行(先正式、后测试):
--   正式 tools> java -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-manu-order-report-panels-20261017.sql
--   测试 tools> set YINJIA_SQL_DB=HSDZ_MES_TEST && java -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-manu-order-report-panels-20261017.sql
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库时不得被切走)
GO
PRINT N'[库] ' + DB_NAME() + N' — 下架 生产工单明细表 / 生产工单统计表(2 张报表面板 + 2 个视图)';
GO
-- ═══ 清单(临时表跨批可用)═══
IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
CREATE TABLE #p (code varchar(40) PRIMARY KEY, nm nvarchar(60), vw sysname);
INSERT INTO #p(code, nm, vw) VALUES
  ('MANU_ORDER_DETAIL', N'生产工单明细表', 'v_manu_order_detail'),
  ('MANU_ORDER_STATS',  N'生产工单统计表', 'v_manu_order_stats');
GO

-- ═══ ① 依赖护栏:这两个视图若已被别的对象引用,先停下(别让 DROP 静默失败/连带破坏)═══
IF EXISTS (
  SELECT 1 FROM sys.sql_expression_dependencies d
  WHERE d.referenced_entity_name IN (SELECT vw FROM #p)
    AND OBJECT_NAME(d.referencing_id) NOT IN (SELECT vw FROM #p)
)
BEGIN
  DECLARE @deps nvarchar(400) = (
    SELECT STRING_AGG(CONVERT(nvarchar(200), OBJECT_NAME(d.referencing_id)), N', ')
    FROM sys.sql_expression_dependencies d
    WHERE d.referenced_entity_name IN (SELECT vw FROM #p)
      AND OBJECT_NAME(d.referencing_id) NOT IN (SELECT vw FROM #p));
  RAISERROR(N'[中止] 仍有对象依赖 v_manu_order_*:%s —— 先处置依赖再下架', 16, 1, @deps);
END
ELSE
  PRINT N'[护栏] 无第三方对象依赖这两个视图,可安全下架';
GO

-- ═══ ② 删视图 ═══
IF OBJECT_ID('dbo.v_manu_order_detail','V') IS NOT NULL
BEGIN DROP VIEW dbo.v_manu_order_detail; PRINT N'[视图] 已删 v_manu_order_detail'; END
ELSE PRINT N'[视图] v_manu_order_detail 不存在(跳过)';
GO
IF OBJECT_ID('dbo.v_manu_order_stats','V') IS NOT NULL
BEGIN DROP VIEW dbo.v_manu_order_stats; PRINT N'[视图] 已删 v_manu_order_stats'; END
ELSE PRINT N'[视图] v_manu_order_stats 不存在(跳过)';
GO

-- ═══ ③ 删面板元数据(角色授权 → 字段 → 面板;顺序无所谓,没有外键,但按从属关系删更直观)═══
DELETE rp FROM yj_role_panel rp JOIN #p p ON rp.panel_code = p.code;
PRINT N'[面板] 删角色授权 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
DELETE f FROM yj_field f JOIN #p p ON f.panel_code = p.code;
PRINT N'[面板] 删字段登记 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
DELETE yp FROM yj_panel yp JOIN #p p ON yp.panel_code = p.code;
PRINT N'[面板] 删面板 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- 面板名译名:守卫 —— 仅当已无任何面板再用这个名字时才删(与 2026-10-16 那批同一写法)
DELETE t FROM yj_translation t JOIN #p p ON t.ref_key = p.nm
WHERE t.scope = N'panel'
  AND NOT EXISTS (SELECT 1 FROM yj_panel yp2 WHERE yp2.panel_name = t.ref_key);
PRINT N'[译名] 删面板名译名 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ═══ ④ 自检:四类残留都必须归零 ═══
DECLARE @bad int = 0;
DECLARE @msg nvarchar(400) = N'';
IF OBJECT_ID('dbo.v_manu_order_detail','V') IS NOT NULL
  BEGIN SET @bad += 1; SET @msg += N' v_manu_order_detail 仍在;'; END
IF OBJECT_ID('dbo.v_manu_order_stats','V') IS NOT NULL
  BEGIN SET @bad += 1; SET @msg += N' v_manu_order_stats 仍在;'; END
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code IN ('MANU_ORDER_DETAIL','MANU_ORDER_STATS'))
  BEGIN SET @bad += 1; SET @msg += N' yj_panel 仍有行;'; END
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code IN ('MANU_ORDER_DETAIL','MANU_ORDER_STATS'))
  BEGIN SET @bad += 1; SET @msg += N' yj_field 仍有行;'; END
IF EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code IN ('MANU_ORDER_DETAIL','MANU_ORDER_STATS'))
  BEGIN SET @bad += 1; SET @msg += N' yj_role_panel 仍有行;'; END
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key IN (N'生产工单明细表', N'生产工单统计表'))
  BEGIN SET @bad += 1; SET @msg += N' 面板名译名仍有行;'; END
-- 反向护栏:物理表必须还在(本批只删视图,别误删在册表)
IF OBJECT_ID('dbo.bd_manu_order','U') IS NULL
  BEGIN SET @bad += 1; SET @msg += N' ⚠ bd_manu_order 丢了(本批不该动它);'; END
IF OBJECT_ID('dbo.bl_manu_order','U') IS NULL
  BEGIN SET @bad += 1; SET @msg += N' ⚠ bl_manu_order 丢了(本批不该动它);'; END

IF @bad > 0
  RAISERROR(N'生产工单明细表/统计表下架自检失败:%s', 16, 1, @msg);
ELSE
  PRINT N'✅ 生产工单明细表 / 生产工单统计表已下架(视图 2 + 面板 2 + 字段 34 + 授权 6 + 译名 18);物理表保留';
GO
