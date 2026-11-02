/*
 * _clear-wlbom-20261029.sql
 * 一次性数据清理(2026-10-29 用户要求):清空「物料清单」面板 WLBOM 的数据。
 *
 * WLBOM(物料清单, 数据建模) => 物理表 dbo.mate(经典遗留 BOM 表, 成品+用料成对成行)
 * 清理前基线:mate 35,578 行 / 6,655 个成品 BOM;yj_doc_status 里 WLBOM 有 1 行状态
 *            (单号 1000056562, saved=Y 草稿),清空后即为孤儿状态,一并删除。
 * 依赖检查:mate 无外键、无触发器;11 个视图(View_BOM / View_OD_WLQTY* / View_WB_WLQTY* /
 *          view_ZZPQTY* / v_barcode_material / v_material_out_*)引用它,清空后返回空集,不报错。
 *
 * 幂等:重复执行 DELETE 命中 0 行。
 * 用法(两个账套都要跑):
 *   cd tools
 *   java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env <脚本>
 *   测试账套把 databaseName 换成 HSDZ_MES_TEST。
 */
SET NOCOUNT ON;

BEGIN TRAN;

DECLARE @deletedMate INT, @deletedStatus INT;

DELETE FROM dbo.mate;
SET @deletedMate = @@ROWCOUNT;

DELETE FROM dbo.yj_doc_status WHERE panel_code = 'WLBOM';
SET @deletedStatus = @@ROWCOUNT;

COMMIT;

SELECT DB_NAME() AS [database], 'deleted_mate' AS [what], @deletedMate AS [rows]
UNION ALL
SELECT DB_NAME(), 'deleted_doc_status', @deletedStatus;

SELECT DB_NAME() AS [database], 'remaining_mate' AS [what], COUNT(*) AS [rows] FROM dbo.mate;
