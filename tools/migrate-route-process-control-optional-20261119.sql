/* =============================================================================
   migrate-route-process-control-optional-20261119.sql
   工艺路线(ROUTE)明细字段「工序控制」(物理列 加工方式)取消必填

   【用户口径 2026-11-19】「工艺路线中工序控制不需要必填。」
     截图:更多 → 表格调整里「工序控制」带「必填」标记 ⇒ 保存工艺路线时该格空着会被
     必填校验拦住。必填真源 = yj_field.required(前端表头 / 明细格校验与角色字段视图
     的「必填」标记都读它;角色字段视图只覆盖显隐,不改必填)。

   【做什么(幂等)】
     ① yj_field:panel_code='ROUTE' 且 label='工序控制'(col_name=加工方式)required → 0;
     ② 自检:该字段 required 仍为 1 的行数必须 = 0,否则 16 级报错(整段不提交)。

   【幂等】目标已是 0 ⇒ UPDATE 0 行,打印 SKIP;UPDATE 语句本身按 required=1 收窄。
   【两账套】HSDZ_MES / HSDZ_MES_TEST 均需执行(DbSync 按清单排队)。
   ⚠ 不要改历史脚本字节(会触发 DbSync 重跑);本脚本只动这一格元数据,不碰表结构。
============================================================================= */
SET NOCOUNT ON;
DECLARE @dbn sysname = DB_NAME();

/* 先取证:改前状态(元数据缺失时也要能看出是"没有这一行"而不是"改失败") */
DECLARE @before int = (SELECT COUNT(*) FROM yj_field
                        WHERE panel_code = 'ROUTE' AND col_name = N'加工方式'
                          AND label = N'工序控制' AND required = 1);
RAISERROR(N'[待改] %s:ROUTE/工序控制 required=1 共 %d 行', 10, 1, @dbn, @before);

IF @before = 0
BEGIN
  RAISERROR(N'[SKIP] %s:工序控制已非必填(或字段不存在),无需改动(幂等)', 10, 1, @dbn);
END
ELSE
BEGIN
  BEGIN TRANSACTION;

  UPDATE yj_field
     SET required = 0
   WHERE panel_code = 'ROUTE'
     AND col_name = N'加工方式'
     AND label = N'工序控制'
     AND required = 1;

  /* 自检:目标字段不得再残留 required=1 */
  IF EXISTS (SELECT 1 FROM yj_field
              WHERE panel_code = 'ROUTE' AND col_name = N'加工方式'
                AND label = N'工序控制' AND required = 1)
  BEGIN
    ROLLBACK TRANSACTION;
    RAISERROR(N'[FAIL] %s:工序控制仍为必填,已回滚', 16, 1, @dbn);
    RETURN;
  END

  COMMIT TRANSACTION;
  RAISERROR(N'[OK] %s:工序控制已改为非必填', 10, 1, @dbn);
END

/* 末尾自检(两态都必须过):该字段 required=1 的行数 = 0 */
IF EXISTS (SELECT 1 FROM yj_field
            WHERE panel_code = 'ROUTE' AND col_name = N'加工方式'
              AND label = N'工序控制' AND required = 1)
  RAISERROR(N'[FAIL] %s:工序控制 required=1 仍有残留', 16, 1, @dbn);
ELSE
  RAISERROR(N'[CHECK-OK] %s:ROUTE/工序控制 非必填(required=0)', 10, 1, @dbn);
