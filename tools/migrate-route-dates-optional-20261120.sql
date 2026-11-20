/* =============================================================================
   migrate-route-dates-optional-20261120.sql
   工艺路线(ROUTE)表头字段「生效日期 / 失效日期」取消必填

   【用户口径 2026-11-20】「工序路线中生效日期和失效日期也不用必填。」
     (承接 2026-11-19「工艺路线中工序控制不需要必填」;同属工艺路线表头/明细的必填收口)

   【做什么(幂等)】
     ① yj_field:panel_code='ROUTE' 且 (col_name,label) ∈ {(生效日期,生效日期),(失效日期,失效日期)}
        的 required → 0;
     ② 自检:这两格 required 仍为 1 的行数必须 = 0,否则 16 级报错并回滚。

   【为什么只改这里】必填真源 = yj_field.required:前端表头/明细校验与「表格调整」的
   「必填」角标都读它;角色字段视图只覆盖显隐,不改必填。
   【幂等】目标已是 0 ⇒ UPDATE 0 行,打印 SKIP;UPDATE 按 required=1 收窄。
   【两账套】HSDZ_MES / HSDZ_MES_TEST 均需执行(DbSync 按清单排队)。
   ⚠ 不改 2026-11-19 的工序控制脚本字节(避免 DbSync 重跑历史脚本);本脚本独立登记。
============================================================================= */
SET NOCOUNT ON;
DECLARE @dbn sysname = DB_NAME();

DECLARE @before int = (SELECT COUNT(*) FROM yj_field
                        WHERE panel_code = 'ROUTE'
                          AND ((col_name = N'生效日期' AND label = N'生效日期')
                            OR (col_name = N'失效日期' AND label = N'失效日期'))
                          AND required = 1);
RAISERROR(N'[待改] %s:ROUTE/生效日期+失效日期 required=1 共 %d 行', 10, 1, @dbn, @before);

IF @before = 0
BEGIN
  RAISERROR(N'[SKIP] %s:两日期已非必填(或字段不存在),无需改动(幂等)', 10, 1, @dbn);
END
ELSE
BEGIN
  BEGIN TRANSACTION;

  UPDATE yj_field
     SET required = 0
   WHERE panel_code = 'ROUTE'
     AND ((col_name = N'生效日期' AND label = N'生效日期')
       OR (col_name = N'失效日期' AND label = N'失效日期'))
     AND required = 1;

  IF EXISTS (SELECT 1 FROM yj_field
              WHERE panel_code = 'ROUTE'
                AND ((col_name = N'生效日期' AND label = N'生效日期')
                  OR (col_name = N'失效日期' AND label = N'失效日期'))
                AND required = 1)
  BEGIN
    ROLLBACK TRANSACTION;
    RAISERROR(N'[FAIL] %s:两日期仍有余留必填,已回滚', 16, 1, @dbn);
    RETURN;
  END

  COMMIT TRANSACTION;
  RAISERROR(N'[OK] %s:生效日期 / 失效日期已改为非必填', 10, 1, @dbn);
END

/* 末尾自检:两格 required=1 必须为 0(含 SKIP 分支) */
IF EXISTS (SELECT 1 FROM yj_field
            WHERE panel_code = 'ROUTE'
              AND ((col_name = N'生效日期' AND label = N'生效日期')
                OR (col_name = N'失效日期' AND label = N'失效日期'))
              AND required = 1)
  RAISERROR(N'[FAIL] %s:两日期 required=1 仍有残留', 16, 1, @dbn);
ELSE
  RAISERROR(N'[CHECK-OK] %s:ROUTE/生效日期+失效日期 非必填(required=0)', 10, 1, @dbn);
