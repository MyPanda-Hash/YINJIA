/* =============================================================================
   migrate-sample-reg-list-order-20261120.sql
   「内部检测目录」(SAMPLE_REG)列表默认按「序号」升序(与 Excel 目录同序)

   【用户口径 2026-11-20】
     第一轮只把序号数据重排成 Excel 的 1~55(migrate-sample-reg-seq-20261120.sql);
     刷新后用户回「还是乱序的」—— 根因是档案列表默认 ORDER BY id DESC(新录入的在最上面),
     屏幕上从上往下是 50、49、48…;序号本身对了,**显示顺序**不对。
     ⇒ 这张面板的列表改为按「序号」升序出去(打开即 1→55)。

   【做什么(幂等)】
     ① yj_panel.config(SAMPLE_REG)追加一个键:
        "listOrder": ["序号", "ASC"]
        读取方:PanelRegistry.PanelDef#listOrder() → QueryService#queryArchive 的 ORDER BY;
        未声明的面板仍走 id DESC,其它面板行为一字不变;
     ② 只改这一行面板配置:不动 yj_field、不动业务数据(序号已在上一支脚本排好);
     ③ 自检:改后 config 必须与目标串**逐字符相等**(⇒ 原有 detailTabLabel / uniqueKeys 都在)。

   【为什么不用 JSON_MODIFY / OPENJSON】
     本库兼容级别 = 100(SQL Server 2008),JSON 函数(ISJSON/JSON_VALUE/JSON_QUERY/
     JSON_MODIFY/OPENJSON)全部不可用(2026-11-20 实测报 Invalid object name 'OPENJSON')。
     ⇒ 用「已知基线串 → 目标串」的精确字符串改写,并加基线守卫:
         · 已是目标串 ⇒ SKIP(幂等);
         · 是已知基线串 ⇒ 改;
         · 其它形态(有人加过别的键)⇒ **不盲写**,16 级报错让人工确认。

   【两账套】HSDZ_MES / HSDZ_MES_TEST 均需执行。
   ⚠ 配套后端代码:PanelRegistry#listOrder / QueryService#queryArchive;
     只跑脚本不重启后端 = 旧 jar 不认这个键,列表顺序不变。
============================================================================= */
SET NOCOUNT ON;
DECLARE @dbn sysname = DB_NAME();

IF OBJECT_ID('dbo.yj_panel') IS NULL
BEGIN
  RAISERROR(N'[SKIP] %s:yj_panel 不存在,本脚本不执行', 10, 1, @dbn);
  RETURN;
END

DECLARE @base nvarchar(max) = N'{"uniqueKeys":[["检测元素"]],"detailTabLabel":"内部检测目录"}';
DECLARE @want nvarchar(max) = N'{"uniqueKeys":[["检测元素"]],"detailTabLabel":"内部检测目录","listOrder":["序号","ASC"]}';
DECLARE @cur  nvarchar(max) = (SELECT config FROM yj_panel WHERE panel_code = N'SAMPLE_REG');
DECLARE @curTxt nvarchar(max) = ISNULL(@cur, N'<null>');

IF @cur IS NULL
BEGIN
  RAISERROR(N'[SKIP] %s:SAMPLE_REG 面板不存在(config 为 NULL),本脚本不执行', 10, 1, @dbn);
  RETURN;
END

RAISERROR(N'[待改] %s:SAMPLE_REG 原 config = %s', 10, 1, @dbn, @curTxt);

IF @cur = @want
BEGIN
  RAISERROR(N'[SKIP] %s:SAMPLE_REG 已声明 listOrder=["序号","ASC"](幂等,无需改动)', 10, 1, @dbn);
  RETURN;
END

IF @cur <> @base
BEGIN
  RAISERROR(N'[FAIL] %s:SAMPLE_REG 的 config 不是已知基线(有人加过别的键?),拒绝盲写 —— 请人工核对后改本脚本', 16, 1, @dbn);
  RETURN;
END

BEGIN TRANSACTION;

UPDATE yj_panel
   SET config = @want
 WHERE panel_code = N'SAMPLE_REG'
   AND config = @base;          -- 守卫:只有仍是基线串才改(防并发/防覆盖别人新增的键)

IF @@ROWCOUNT <> 1
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR(N'[FAIL] %s:SAMPLE_REG config 在事务内已变化(期望更新 1 行),已回滚', 16, 1, @dbn);
  RETURN;
END

DECLARE @after nvarchar(max) = (SELECT config FROM yj_panel WHERE panel_code = N'SAMPLE_REG');
IF ISNULL(@after, N'') <> @want
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR(N'[FAIL] %s:SAMPLE_REG config 改后与目标串不符,已回滚', 16, 1, @dbn);
  RETURN;
END

COMMIT TRANSACTION;
RAISERROR(N'[OK] %s:SAMPLE_REG 列表默认排序已声明为 [序号, ASC];config = %s', 10, 1, @dbn, @after);
