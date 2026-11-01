/*
  完工明细(WO_COMPLETION_LIST)列表默认排序:完工时间倒序,最新在上、最旧在下。

  用户口径(2026-10-21):「让当前完工明细的数据按时间排列从上到下进行,上面是新日期的,
  下方为旧日期的」。

  根因:本面板是 flat 只读视图(v_wo_completion_detail),建面板时 date_col 留空
  (见 migrate-wo-completion-list.sql 的 UPDATE date_col=NULL)。QueryService.queryFlat
  在没有日期列时退回 `ORDER BY t.id DESC`(报工行自增 id 顺序),而 id 顺序 ≠ 完工时间顺序
  —— 补录/重排/多工单并行报工后,新旧行会交错,列表上就会看到 10-16 的行排在 10-15 的行下面。

  修法(只改元数据,不动任何业务数据/视图/字段/权限):
    yj_panel.date_col = N'wgsj'         -- 视图里「完工时间」的物理列名
  ⇒ QueryService.queryFlat 走「有日期列」分支:
      ORDER BY t.[wgsj] DESC, t.id DESC
    同一时刻完工的行按 id 倒序,分页稳定(2026-10-14 其它列表同款口径)。

  注意事项:
  1. date_col 必须写**物理列名** wgsj,不是字段标签「完工时间」;QueryService 取数前会用
     sys.columns 校验该列是否真实存在,列不存在会静默退回 id 排序(改错不报错,只表现为没效果)。
  2. 本脚本必须排在 db-migrations.txt 中 migrate-wo-completion-list.sql 之后——那条历史脚本
     会把 date_col 写回 NULL;全量重放按清单顺序执行,本脚本在后才不会被盖掉。
  3. 幂等:重复执行只把同一行写成同一值;面板/视图/列缺失时直接 THROW,不静默跳过。
  4. 两账套都要执行(DbSync 默认正式库,测试库用 YINJIA_SQL_DB=HSDZ_MES_TEST)。
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST,禁止在其他数据库执行。', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = N'WO_COMPLETION_LIST')
    THROW 51000, N'缺少 WO_COMPLETION_LIST 面板,请先应用 migrate-wo-completion-list.sql。', 1;
IF OBJECT_ID(N'dbo.v_wo_completion_detail', N'V') IS NULL
    THROW 51000, N'缺少 v_wo_completion_detail 视图,请先应用 migrate-wo-completion-list.sql。', 1;
IF COL_LENGTH(N'dbo.v_wo_completion_detail', N'wgsj') IS NULL
    THROW 51000, N'v_wo_completion_detail 缺少 wgsj(完工时间)列,无法按时间排序。', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    UPDATE dbo.yj_panel
       SET date_col = N'wgsj'
     WHERE panel_code = N'WO_COMPLETION_LIST';
    IF @@ROWCOUNT <> 1
        THROW 51000, N'完工明细面板行数异常,未更新 date_col。', 1;

    -- 窄范围守卫:只认本面板,且只认刚写入的物理列名。
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel
                    WHERE panel_code = N'WO_COMPLETION_LIST' AND date_col = N'wgsj')
        THROW 51000, N'完工明细 date_col 未写入 wgsj。', 1;
    IF EXISTS (SELECT 1 FROM dbo.yj_panel
                WHERE panel_code = N'WO_COMPLETION_LIST'
                  AND (line_table <> N'v_wo_completion_detail' OR mode <> N'flat'))
        THROW 51000, N'完工明细面板契约已变(应为 flat + v_wo_completion_detail),请人工复核。', 1;

    COMMIT TRANSACTION;

    SELECT panel_code, panel_name, mode, line_table, date_col,
           N'ORDER BY wgsj DESC, id DESC' AS expected_sort
      FROM dbo.yj_panel
     WHERE panel_code = N'WO_COMPLETION_LIST';

    RAISERROR(N'[PASS] 完工明细列表默认排序 = 完工时间(wgsj) DESC, id DESC:新日期在上、旧日期在下。', 10, 1) WITH NOWAIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
