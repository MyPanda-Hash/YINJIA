/* migrate-drop-orphan-fields-20261017.sql — 清理已下架面板残留的孤儿 yj_field 行(13 行)

   【问题】数据库规范体检 05 项报「元数据漂移 13 处」:
     QC_MOLD_INSP 6 行(检查频率 + 测量值1..5)
     QC_CUT_INSP  6 行(同上)
     SL_RECV      1 行(计量单位)
   这三张面板在 yj_panel 里已经不存在,字段行却还在 —— 纯元数据垃圾。

   【为什么不影响运行】运行期所有 yj_field 查询都带 panel_code=yj_panel 里存在的码
     (PanelRegistry 全量加载后按面板分组,其余两处 JOIN yj_panel),
     没有面板行 ⇒ 这些字段永远不会被组装成配置下发;现役 jar 扫描也 [PASS] 无已下架对象引用。

   【根因(2026-10-17 核实)】
     · QC_MOLD_INSP / QC_CUT_INSP 的 12 行:下架脚本 2026-10-16 12:46:22 执行后,
       同日 16:10:25 又执行了 migrate-insp-measure5-20261016.sql —— 它的面板清单
       (@fp 与若干 UPDATE)里仍写着这两张已下架面板,给它们插回 6+6 行字段;
       它加**物理列**时有 OBJECT_ID 守卫,给 **yj_field 插行**时没有 ⇒ 只留下字段行。
     · SL_RECV 的 1 行:2026-09-20 面板编码 SL_RECV → QC_RECV 改名时漏搬「计量单位」。

   【本脚本只清字段行】不动 yj_translation(检查频率/测量值1..5 等标签仍被
     QC_PROC_INSP/QC_ASM_INSP 使用,按标签全局共享),不动 yj_usage_log 审计流水。

   【幂等】重跑 = 0 行。两账套(先正式、后测试)均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

DECLARE @db sysname = DB_NAME();
DECLARE @orph TABLE (code varchar(40) PRIMARY KEY);
INSERT INTO @orph (code) VALUES (N'QC_MOLD_INSP'), (N'QC_CUT_INSP'), (N'SL_RECV');

DECLARE @before int = (SELECT COUNT(*) FROM yj_field f
                        WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code));
RAISERROR(N'[库] %s 清理前:全库孤儿 yj_field = %d 行', 10, 1, @db, @before);

DECLARE @del int;
DELETE f FROM yj_field f
  JOIN @orph o ON o.code = f.panel_code
 WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code);
SET @del = @@ROWCOUNT;
RAISERROR(N'[OK] %s 删除孤儿 yj_field %d 行(QC_MOLD_INSP / QC_CUT_INSP / SL_RECV)', 10, 1, @db, @del);
GO

/* ===== 自检:全库不得再有「面板不存在的字段行」 ===== */
DECLARE @bad int = (SELECT COUNT(*) FROM yj_field f
                     WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code));
IF @bad > 0
    RAISERROR(N'[FAIL] 仍有孤儿 yj_field %d 行', 16, 1, @bad);
ELSE
    PRINT N'[OK] 孤儿 yj_field = 0 行';
GO
