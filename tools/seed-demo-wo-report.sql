-- seed-demo-wo-report.sql
-- 为《MES管理系统-界面截图.docx》的「报工记录」截图补**演示数据**(2026-10-15)
--
-- 背景(用户口径):
--   左侧 logo 系统名由「轻MES」改为「银嘉数字化平台」,两个界面截图文档要按新 logo 重截。
--   重截时发现「报工记录」面板在当前库里**已经没有任何数据**(scjl 0 行),而旧图里有 7 行 ——
--   直接把旧图换成"暂无符合条件的数据"的空表截图没有展示价值。
--   用户拍板:先造演示数据再截,且**只造到测试库 HSDZ_MES_TEST**(不污染正式账)。
--
-- ⚠ 作用域与安全:
--   · 本脚本**只应跑在 HSDZ_MES_TEST**。它带库名守卫:数据库名不是测试库就直接中止,
--     避免误在正式库 HSDZ_MES 上灌演示数据(全量部署路线会把本地库整体推给服务器)。
--   · 全部行打标记 asp_user1='demo-seed-1015' + 报工单号前缀 'DEMO-' ⇒ 可一键清理,
--     清理脚本见文件末尾注释(或 tools/cleanup-demo-wo-report.sql,如已建)。
--   · 幂等:先按标记删除自己造过的行,再插入 ⇒ 反复执行不会堆重复数据。
--   · 数据来源:工单号/生产线取自正式库真实工单(MO-2026-09-0002 成型1线 / MO-2026-09-0004 成型3线),
--     产品取自真实明细(CP003 铝型材-散热片 等),使截图看起来像真实业务而非乱填。
--
-- 执行:YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar DbSync.java run seed-demo-wo-report.sql
SET NOCOUNT ON;
GO

-- ═══ 库名守卫:只允许测试库 ═══
-- ⚠ RAISERROR 的参数位不接受函数调用(实测报「"DB_NAME"附近有语法错误」),先取到变量再拼。
DECLARE @db sysname = DB_NAME();
IF @db NOT LIKE N'%_TEST'
BEGIN
  RAISERROR(N'[ABORT] seed-demo-wo-report 只允许在测试库(_TEST)执行,当前库=%s —— 已中止,未写入任何数据。', 16, 1, @db);
  RETURN;
END
GO

-- ═══ 幂等:先清掉本脚本此前造的行 ═══
DELETE FROM scjl WHERE asp_user1 = N'demo-seed-1015';
PRINT N'[OK] 清理旧演示行,影响 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ═══ 插入 7 行演示报工记录(对齐旧图的 7 行观感)═══
-- 列映射取自 yj_field(WO_REPORT_LIST 可见列 → 物理列):
--   单据编号=报工单号 · 单据日期=sc_date · 工单号=gldh · 批次号=批次号 · 工序=gxdm
--   报工数量=sl · 直销数量=直销数量 · 生产线=scx · 完工状态=wgzt · 入库单号=post_no · 报工人=ywman
-- ⚠ scjl.id 是 **IDENTITY** 列(实测插显式值会报「不能为标识列插入显式值」)⇒ 不列 id,由库里自增。
-- ⚠ 列宽约束(实测 INFORMATION_SCHEMA):批次号 nvarchar(12) ⇒ 批次值**不得超过 12 字符**
--   (首版用 MO20260902001=13 字符,报「将截断字符串或二进制数据」);
--   报工单号 nvarchar(30)、scx nvarchar(36)、wgzt nvarchar(4)、gxdm nvarchar(16) 均在限内。
-- ⚠ NOT NULL 列(实测):comm nvarchar(40)、sc_no nvarchar(28)、id(IDENTITY)——
--   前两列**不参与面板显示**(yj_field 里没登记),属遗留必填列;这里按语义填
--   (comm=报工单号同值以保非空;sc_no=来源生产单号,演示用同一工单号)。id 由库自增。
INSERT INTO scjl (comm, sc_no, 报工单号, sc_date, gldh, 批次号, gxdm, sl, 直销数量, scx, wgzt, post_no, ywman,
                  mc, gg, jldw, asp_user1, asp_time1, asp_cancel, delmark)
SELECT v.报工单号, v.工单号, v.报工单号, v.单据日期, v.工单号, v.批次号, v.工序, v.报工数量, v.直销数量,
       v.生产线, v.完工状态, v.入库单号, v.报工人, v.品名, v.规格, v.单位,
       N'demo-seed-1015', GETDATE(), N'N', 0
FROM (VALUES
  (N'DEMO-BG-0001', CAST('2026-09-20T08:01:39' AS datetime), N'MO-2026-09-0002', N'MO260902001', N'混料', 280.0,  0.0, N'成型1线', N'是', N'', N'admin', N'铝型材-散热片', N'120×60', N'件'),
  (N'DEMO-BG-0002', CAST('2026-09-20T08:35:30' AS datetime), N'MO-2026-09-0002', N'MO260902002', N'成型', 11.0,   0.0, N'成型1线', N'是', N'', N'admin', N'铝型材-散热片', N'120×60', N'件'),
  (N'DEMO-BG-0003', CAST('2026-09-21T09:44:14' AS datetime), N'MO-2026-09-0004', N'MO260904003', N'切炭', 6900.0, 0.0, N'成型3线', N'是', N'', N'admin', N'炭棒滤芯',     N'57×21',  N'支'),
  (N'DEMO-BG-0004', CAST('2026-09-22T10:26:17' AS datetime), N'MO-2026-09-0004', N'MO260904004', N'组装', 33.0,   2.0, N'成型3线', N'是', N'', N'admin', N'炭棒滤芯',     N'57×21',  N'支'),
  (N'DEMO-BG-0005', CAST('2026-09-22T10:25:25' AS datetime), N'MO-2026-09-0004', N'MO260904005', N'装箱', 33.0,   0.0, N'成型3线', N'是', N'', N'admin', N'炭棒滤芯',     N'57×21',  N'支'),
  (N'DEMO-BG-0006', CAST('2026-09-23T02:24:43' AS datetime), N'MO-2026-09-0002', N'MO260902006', N'混料', 33.0,   0.0, N'成型1线', N'是', N'', N'admin', N'铝型材-散热片', N'120×60', N'件'),
  (N'DEMO-BG-0007', CAST('2026-09-23T01:58:56' AS datetime), N'MO-2026-09-0002', N'MO260902007', N'成型', 22.0,   0.0, N'成型1线', N'是', N'', N'admin', N'铝型材-散热片', N'120×60', N'件')
) AS v(报工单号, 单据日期, 工单号, 批次号, 工序, 报工数量, 直销数量, 生产线, 完工状态, 入库单号, 报工人, 品名, 规格, 单位);

PRINT N'[OK] 插入演示报工记录 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ═══ 自检(信息级,不中断)═══
DECLARE @n int = (SELECT COUNT(*) FROM scjl WHERE asp_user1 = N'demo-seed-1015');
DECLARE @db2 sysname = DB_NAME();
IF @n = 7
  RAISERROR(N'SELFCHECK OK  scjl 演示行 = %d(库=%s)', 10, 1, @n, @db2) WITH NOWAIT;
ELSE
  RAISERROR(N'SELFCHECK FAIL scjl 演示行 = %d(期望 7)', 16, 1, @n);
GO

PRINT N'seed-demo-wo-report 完成(清理:DELETE FROM scjl WHERE asp_user1=N''demo-seed-1015'';)';
GO
