-- migrate-stock-flow-trace-cols-20261015.sql
-- 任务:把**服务器上已经手工加过**的 11 个追溯列,反向同步成仓库里的正式迁移脚本。
--   源 = 服务器备份 yjmes2.bak(源库 HSDZ_MES,2026-10-15 09:52)还原出的对照库 YJMES2_SRV_1015;
--   口径 = **照服务器现状同步**(用户 2026-10-15 明确选择):列名/类型/长度/可空**逐列对着服务器写**,
--   **不"顺手优化"**(余下 3 个 *ID 列在服务器上就是 float(8)/precision 53,不是 int)。
--   范围:`inh` 47→58 列(+11)/`outh` 48→59 列(+11);只加列 + 补中文注明,**不动既有列、不动索引、不改任何业务数据**。
--
-- ⚠ ⑥ **2026-10-15 后续修订(用户明确要求,有意偏离服务器现状 —— 与上面的"照服务器同步"口径的例外)**:
--      · 工单追溯列**不叫 `工单ID`**,叫 **`工单项次`**,类型 **int**(服务器上人工加的那列是 `工单ID`
--        float(8)/precision 53)—— 用户要求与来源单据头的 `bd_finish_in.工单行号` / `bd_material_out.工单行号`
--        的 int 对齐。**其余 3 个 *ID(订单ID/采购ID/委外ID)仍照服务器保持 float,未动。**
--      · `工单项次` 列注明 = 「工单项次(= 来源单据头的「工单行号」,与「工单号」共同定位工单明细行;两列合起来才是唯一键)」。
--      · `审核` 列注明按用户口径 = 「审核标记:审核=Y / 没审核=N」(不再沿用早期"不采纳 Y/N"的写法;见 ② 段头)。
--      库侧已先按同一形态改好(两账套 sp_rename + ALTER COLUMN + 改注明);本脚本负责**收敛到同一形态且幂等**:
--      老环境(已按旧方案建了 工单ID float)⇒ 改名 + 纠类型;新环境(什么都没有)⇒ 直接建 int;
--      已是目标态 ⇒ 三段全 no-op。
--
-- ⚠ ① inh/outh 上有**过滤唯一索引**(UX_inh_src_rid / UX_outh_src_rid ... WHERE rid IS NOT NULL);
--      ALTER TABLE 在 QUOTED_IDENTIFIER OFF 的会话下会报 **error 1934** —— 故本文件头部显式打开
--      (sqlcmd 另可加 -I;DbSync 走 JDBC 本就是 ON)。先例:migrate-stock-flow-tax-cols-2026-09-30.sql 头注。
-- ⚠ ② 幂等:**逐列分开判**(IF COL_LENGTH(...) IS NULL),部分执行过也能收敛;
--      一把梭(一段里连写 11 个 ALTER)在中途失败后无法续跑。
-- ⚠ ③ 列注明查存在时**必须带 ep.class = 1** —— 规范铁律:不带会把索引的 index_id 当成列的 minor_id
--      (两者同域),导致注释被**静默漏写**(kucun.备用1 中过招)。
-- ⚠ ④ **不设默认值**(对齐 docs/design/inh-outh加字段与扫码溯源评估.md §9.3「全部 NULL、不设 NOT NULL、
--      不设默认值、不动索引」+ 本次只加列)。**与服务器的结构性差异有两处,均有意为之**:① 见头注 ⑥ ——
--      工单追溯列本脚本用 `工单项次` int,服务器叫 `工单ID` float(用户 2026-10-15 明确要求);② 默认值 ——
--      服务器上这几个 *ID 列带 `DEFAULT (0)`、`审核` 带 `DEFAULT (N'N')`(sys.default_constraints 实测:
--      DF_inh_od_xc/DF_inh_订单ID1/DF_inh_采购单ID1/DF_inh_工单号ID1/DF_inh_审核 及 outh 同款),
--      本脚本**有意不复制**(默认值只影响新行;且没有任何代码写这些列)。要完全对齐只需另加 10 条
--      `ALTER TABLE ... ADD CONSTRAINT DF_... DEFAULT ... FOR [列]`,一行可补。
-- ⚠ ⑤ 列序说明:ALTER TABLE ADD 只能追加到末尾,故本脚本按服务器 column_id 顺序补 —— 9 个尾列
--      (订单号…审核)在本库落位 50..58 / 51..59,与服务器**逐个同位**;而 asp_user3/asp_time3 落在
--      48/49(服务器上它们是第 23/24 列,由更早一次 ALTER 加的)—— 只有这 2 列的**序号**不同,
--      列名/类型/长度/可空全部一致。要连序号都一致必须重建表,不划算且违背「不动既有列」。
-- 幂等;两账套均执行(先 HSDZ_MES,后 HSDZ_MES_TEST)。
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
GO

-- ⓪ 前置校验:流水表就位才动它(不满足就让本批抛错,DbSync 会中止整个文件,库保持"改动前"状态)
IF COL_LENGTH('dbo.inh', N'src') IS NULL OR COL_LENGTH('dbo.outh', N'src') IS NULL
  RAISERROR(N'[FAIL] inh/outh 还不是 MES 流水表(缺 src 列),请先执行 migrate-stock-flow-tables-2026-09-30.sql。本脚本未改动任何对象', 16, 1);
GO

/* ═══════════════════════════════════════════════════════════════════════════
   ① 加列(22 条:inh 11 + outh 11;逐列判存在,幂等)
   类型/长度取自服务器 sys.columns 实测(2026-10-15 YJMES2_SRV_1015 对照);**`工单项次` 是唯一例外,见头注 ⑥**:
     · asp_user3   nvarchar(20)   ← 服务器实测 20(**不是 40**;本库 asp_user1/2/4 是 40,这列不一样)
     · asp_time3   datetime2
     · 订单号/采购单号/工单号/委外单号  nvarchar(24)  ← 服务器实测 24(不是 48)
     · 订单ID/采购ID/委外ID            float(53)     ← 服务器实测 float(这 3 个**不改成 int**)
     · 工单项次    int             ← ⚠ **有意偏离服务器**(服务器那列叫 `工单ID`,float(53),用户要求改为 int,
                                      与头表 工单行号 int 对齐);走下面的三段式:老环境改名+纠类型 / 新环境直接建 int
     · 审核        nvarchar(2)    ← 服务器实测 2(不是 4)
   全部 NULL 可空。
   ═══════════════════════════════════════════════════════════════════════════ */
-- inh:先补 asp_user3/asp_time3,再补 9 个尾列 —— 这样 9 个尾列的 column_id 与服务器逐个同位
IF COL_LENGTH('dbo.inh', N'asp_user3') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [asp_user3] nvarchar(20) NULL;
  PRINT N'[OK] inh.asp_user3 已添加';
END
ELSE PRINT N'[SKIP] inh.asp_user3 已存在';
GO
IF COL_LENGTH('dbo.inh', N'asp_time3') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [asp_time3] datetime2 NULL;
  PRINT N'[OK] inh.asp_time3 已添加';
END
ELSE PRINT N'[SKIP] inh.asp_time3 已存在';
GO
IF COL_LENGTH('dbo.inh', N'订单号') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [订单号] nvarchar(24) NULL;
  PRINT N'[OK] inh.订单号 已添加';
END
ELSE PRINT N'[SKIP] inh.订单号 已存在';
GO
IF COL_LENGTH('dbo.inh', N'订单ID') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [订单ID] float NULL;
  PRINT N'[OK] inh.订单ID 已添加';
END
ELSE PRINT N'[SKIP] inh.订单ID 已存在';
GO
IF COL_LENGTH('dbo.inh', N'采购单号') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [采购单号] nvarchar(24) NULL;
  PRINT N'[OK] inh.采购单号 已添加';
END
ELSE PRINT N'[SKIP] inh.采购单号 已存在';
GO
IF COL_LENGTH('dbo.inh', N'采购ID') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [采购ID] float NULL;
  PRINT N'[OK] inh.采购ID 已添加';
END
ELSE PRINT N'[SKIP] inh.采购ID 已存在';
GO
IF COL_LENGTH('dbo.inh', N'工单号') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [工单号] nvarchar(24) NULL;
  PRINT N'[OK] inh.工单号 已添加';
END
ELSE PRINT N'[SKIP] inh.工单号 已存在';
GO
-- inh 工单追溯列 = 三段式幂等(应对三种环境;每段各自成批,改名后再按新名编译才安全)
-- ① 老环境:已按旧方案建了 工单ID ⇒ 先改名(而不是再建一列)
IF COL_LENGTH('dbo.inh', N'工单ID') IS NOT NULL AND COL_LENGTH('dbo.inh', N'工单项次') IS NULL
BEGIN
  EXEC sp_rename N'dbo.inh.工单ID', N'工单项次', N'COLUMN';
  PRINT N'[MIGRATE] inh.工单ID → 工单项次';
END
ELSE PRINT N'[SKIP] inh.工单ID 无需改名';
GO
-- ② 新环境:还没有 工单项次 ⇒ 建(类型就是 int,不是 float)
IF COL_LENGTH('dbo.inh', N'工单项次') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [工单项次] int NULL;
  PRINT N'[OK] inh.工单项次 已添加(int)';
END
ELSE PRINT N'[SKIP] inh.工单项次 已存在';
GO
-- ③ 已存在但类型不对(例如老环境刚从 float 改名过来)⇒ 纠正为 int(system_type_id 56 = int)
IF EXISTS (SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID(N'dbo.inh') AND name = N'工单项次' AND system_type_id <> 56)
BEGIN
  ALTER TABLE dbo.inh ALTER COLUMN [工单项次] int NULL;
  PRINT N'[FIX] inh.工单项次 类型纠正为 int';
END
GO
IF COL_LENGTH('dbo.inh', N'委外单号') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [委外单号] nvarchar(24) NULL;
  PRINT N'[OK] inh.委外单号 已添加';
END
ELSE PRINT N'[SKIP] inh.委外单号 已存在';
GO
IF COL_LENGTH('dbo.inh', N'委外ID') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [委外ID] float NULL;
  PRINT N'[OK] inh.委外ID 已添加';
END
ELSE PRINT N'[SKIP] inh.委外ID 已存在';
GO
IF COL_LENGTH('dbo.inh', N'审核') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [审核] nvarchar(2) NULL;
  PRINT N'[OK] inh.审核 已添加';
END
ELSE PRINT N'[SKIP] inh.审核 已存在';
GO
-- outh:同样 11 列(与 inh 逐列定义一致,含 `工单项次` int —— 见头注 ⑥ 与脚本尾自检)
IF COL_LENGTH('dbo.outh', N'asp_user3') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [asp_user3] nvarchar(20) NULL;
  PRINT N'[OK] outh.asp_user3 已添加';
END
ELSE PRINT N'[SKIP] outh.asp_user3 已存在';
GO
IF COL_LENGTH('dbo.outh', N'asp_time3') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [asp_time3] datetime2 NULL;
  PRINT N'[OK] outh.asp_time3 已添加';
END
ELSE PRINT N'[SKIP] outh.asp_time3 已存在';
GO
IF COL_LENGTH('dbo.outh', N'订单号') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [订单号] nvarchar(24) NULL;
  PRINT N'[OK] outh.订单号 已添加';
END
ELSE PRINT N'[SKIP] outh.订单号 已存在';
GO
IF COL_LENGTH('dbo.outh', N'订单ID') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [订单ID] float NULL;
  PRINT N'[OK] outh.订单ID 已添加';
END
ELSE PRINT N'[SKIP] outh.订单ID 已存在';
GO
IF COL_LENGTH('dbo.outh', N'采购单号') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [采购单号] nvarchar(24) NULL;
  PRINT N'[OK] outh.采购单号 已添加';
END
ELSE PRINT N'[SKIP] outh.采购单号 已存在';
GO
IF COL_LENGTH('dbo.outh', N'采购ID') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [采购ID] float NULL;
  PRINT N'[OK] outh.采购ID 已添加';
END
ELSE PRINT N'[SKIP] outh.采购ID 已存在';
GO
IF COL_LENGTH('dbo.outh', N'工单号') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [工单号] nvarchar(24) NULL;
  PRINT N'[OK] outh.工单号 已添加';
END
ELSE PRINT N'[SKIP] outh.工单号 已存在';
GO
-- outh 工单追溯列 = 同款三段式幂等(每段各自成批)
-- ① 老环境:已建 工单ID ⇒ 改名
IF COL_LENGTH('dbo.outh', N'工单ID') IS NOT NULL AND COL_LENGTH('dbo.outh', N'工单项次') IS NULL
BEGIN
  EXEC sp_rename N'dbo.outh.工单ID', N'工单项次', N'COLUMN';
  PRINT N'[MIGRATE] outh.工单ID → 工单项次';
END
ELSE PRINT N'[SKIP] outh.工单ID 无需改名';
GO
-- ② 新环境:还没有 ⇒ 建(类型 int,不是 float)
IF COL_LENGTH('dbo.outh', N'工单项次') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [工单项次] int NULL;
  PRINT N'[OK] outh.工单项次 已添加(int)';
END
ELSE PRINT N'[SKIP] outh.工单项次 已存在';
GO
-- ③ 类型不对(例如刚从 float 改名过来)⇒ 纠正为 int
IF EXISTS (SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID(N'dbo.outh') AND name = N'工单项次' AND system_type_id <> 56)
BEGIN
  ALTER TABLE dbo.outh ALTER COLUMN [工单项次] int NULL;
  PRINT N'[FIX] outh.工单项次 类型纠正为 int';
END
GO
IF COL_LENGTH('dbo.outh', N'委外单号') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [委外单号] nvarchar(24) NULL;
  PRINT N'[OK] outh.委外单号 已添加';
END
ELSE PRINT N'[SKIP] outh.委外单号 已存在';
GO
IF COL_LENGTH('dbo.outh', N'委外ID') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [委外ID] float NULL;
  PRINT N'[OK] outh.委外ID 已添加';
END
ELSE PRINT N'[SKIP] outh.委外ID 已存在';
GO
IF COL_LENGTH('dbo.outh', N'审核') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [审核] nvarchar(2) NULL;
  PRINT N'[OK] outh.审核 已添加';
END
ELSE PRINT N'[SKIP] outh.审核 已存在';
GO

/* ═══════════════════════════════════════════════════════════════════════════
   ② 列级中文注明(22 条)
   文案口径(2026-10-15 用户口径;**下列 2 处与本脚本早期版本不同**,见头注 ⑥):
     · 全部 22 条都写(用户明确要求;asp_user3/asp_time3 与服务器文案逐字一致 = 审核人/审核时间)
     · `工单项次`(原 `工单ID`)—— 按用户口径:「工单项次(= 来源单据头的「工单行号」,与「工单号」
       共同定位工单明细行;两列合起来才是唯一键)」;列名/类型同步改为 工单项次 int。
     · `审核` —— 按用户口径:「审核标记:审核=Y / 没审核=N」。
       (早期版本曾以"服务器实测该列 nvarchar(2) 且现网全为 NULL、无 Y/N 证据"为由**不采纳** Y/N 说法,
        改写为 asp_cancel 分工说明 —— **该写法已按用户口径更正**;此口径依据是用户业务定义,不是现网数据。)
     · 其余空列(4 个单号 + 3 个 *ID 共 7 列)在服务器上**全为 NULL/全为 0**,是预留位,
       文案里加「现网全为 NULL / 服务器现状 float + 默认 0,不为整型」,免得后来人当成已有数据的字段用。
   实现:表变量 + 游标逐条写(先判存在:存在走 sp_updateextendedproperty,不存在走 sp_addextendedproperty)——
   这样即使某环境上已有人写过**空串**注释(服务器上这 9 个中文列就是 MS_Description=''),
   也会被本脚本改成正式文案,而不是报 15233「属性已存在」。
   ═══════════════════════════════════════════════════════════════════════════ */
DECLARE @cmt TABLE (tbl sysname, col sysname, txt nvarchar(400));
INSERT INTO @cmt (tbl, col, txt) VALUES
 (N'inh', N'asp_user3',  N'审核人'),
 (N'inh', N'asp_time3',  N'审核时间'),
 (N'inh', N'订单号',     N'来源单据的销售订单号(扫码溯源用;服务器现网全为 NULL,暂无代码写入)'),
 (N'inh', N'订单ID',     N'销售订单主表 id(按订单号反查;服务器现状 float + 默认 0,照服务器原样不为整型)'),
 (N'inh', N'采购单号',   N'采购订单号(= bd_purchase_in.采购订单号;仅采购入库段有值。现网全为 NULL,暂无代码写入)'),
 (N'inh', N'采购ID',     N'采购订单主表 id(按采购单号反查;服务器现状 float + 默认 0,不为整型)'),
 (N'inh', N'工单号',     N'生产工单号(= bd_finish_in / bd_material_out.加工单号;现网全为 NULL,暂无代码写入)'),
 (N'inh', N'工单项次',   N'工单项次(= 来源单据头的「工单行号」,与「工单号」共同定位工单明细行;两列合起来才是唯一键)'),
 (N'inh', N'委外单号',   N'委外加工单号(当前无来源:委外入库/发料单据 2026-10-08 已下架;预留)'),
 (N'inh', N'委外ID',     N'委外加工单主表 id(当前无来源,预留;服务器现状 float + 默认 0,不为整型)'),
 (N'inh', N'审核',       N'审核标记:审核=Y / 没审核=N'),
 (N'outh', N'asp_user3', N'审核人'),
 (N'outh', N'asp_time3', N'审核时间'),
 (N'outh', N'订单号',    N'来源单据的销售订单号(扫码溯源用;服务器现网全为 NULL,暂无代码写入)'),
 (N'outh', N'订单ID',    N'销售订单主表 id(按订单号反查;服务器现状 float + 默认 0,照服务器原样不为整型)'),
 (N'outh', N'采购单号',  N'采购订单号(= bd_purchase_in.采购订单号;仅采购入库段有值。现网全为 NULL,暂无代码写入)'),
 (N'outh', N'采购ID',    N'采购订单主表 id(按采购单号反查;服务器现状 float + 默认 0,不为整型)'),
 (N'outh', N'工单号',    N'生产工单号(= bd_finish_in / bd_material_out.加工单号;现网全为 NULL,暂无代码写入)'),
 (N'outh', N'工单项次',  N'工单项次(= 来源单据头的「工单行号」,与「工单号」共同定位工单明细行;两列合起来才是唯一键)'),
 (N'outh', N'委外单号',  N'委外加工单号(当前无来源:委外入库/发料单据 2026-10-08 已下架;预留)'),
 (N'outh', N'委外ID',    N'委外加工单主表 id(当前无来源,预留;服务器现状 float + 默认 0,不为整型)'),
 (N'outh', N'审核',      N'审核标记:审核=Y / 没审核=N');

DECLARE @t sysname, @c sysname, @txt nvarchar(400), @obj int, @cid int, @added int = 0, @upd int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, txt FROM @cmt ORDER BY tbl DESC, col;
OPEN cur;
FETCH NEXT FROM cur INTO @t, @c, @txt;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @obj = OBJECT_ID(N'dbo.' + @t);
  SET @cid = COLUMNPROPERTY(@obj, @c, 'ColumnId');
  IF @obj IS NOT NULL AND @cid IS NOT NULL
  BEGIN
    -- ⚠ ep.class = 1 必须带:否则 index_id 会撞上备用列的 column_id,注释静默漏写
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = @obj AND ep.minor_id = @cid AND ep.name = N'MS_Description')
    BEGIN
      EXEC sp_updateextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
      SET @upd = @upd + 1;
    END
    ELSE
    BEGIN
      EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
      SET @added = @added + 1;
    END
  END
  FETCH NEXT FROM cur INTO @t, @c, @txt;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[注明] 新增 ' + CAST(@added AS nvarchar(4)) + N' 条 / 更新 ' + CAST(@upd AS nvarchar(4)) + N' 条';
GO

/* ═══════════════════════════════════════════════════════════════════════════
   ③ 自检(把数字打给 DbSync 看:PRINT 走 warning 码 0 不回显,故用 severity 10 的 RAISERROR)
      ① inh/outh 列数 = 58 / 59;
      ② 22 列**逐列类型/字节长度/precision/scale/可空**符合契约(其中 `工单项次` int 是**有意偏离服务器**的
        用户要求,其余 21 列同服务器实测 —— 见头注 ⑥);
      ③ 22 条列注明都在且非空串;
      ④ 与服务器同名 10 列(工单那列除外)的**定义串**逐字相等(类型+长度+可空;序号见头注⑤)。
      任一不符即 RAISERROR 16 ⇒ DbSync 判 FAIL(不写 yj_schema_log),人工处理后重跑。
   ═══════════════════════════════════════════════════════════════════════════ */
DECLARE @expect TABLE (tbl sysname, col sysname, typ sysname, len int, prec int, scl int, nullable bit);
INSERT INTO @expect (tbl, col, typ, len, prec, scl, nullable) VALUES
 -- inh(长度=字符数;datetime2 prec 27/scl 7;float prec 53 —— 取自服务器 sys.columns 实测;
 --      例外:`工单项次` int prec 10 —— 用户要求的**有意偏离**(服务器那列是 工单ID float),见头注 ⑥)
 (N'inh', N'asp_user3', N'nvarchar', 20,  0, 0, 1),
 (N'inh', N'asp_time3', N'datetime2', 8, 27, 7, 1),
 (N'inh', N'订单号',    N'nvarchar', 24,  0, 0, 1),
 (N'inh', N'订单ID',    N'float',     8, 53, 0, 1),
 (N'inh', N'采购单号',  N'nvarchar', 24,  0, 0, 1),
 (N'inh', N'采购ID',    N'float',     8, 53, 0, 1),
 (N'inh', N'工单号',    N'nvarchar', 24,  0, 0, 1),
 (N'inh', N'工单项次',  N'int',       4, 10, 0, 1),
 (N'inh', N'委外单号',  N'nvarchar', 24,  0, 0, 1),
 (N'inh', N'委外ID',    N'float',     8, 53, 0, 1),
 (N'inh', N'审核',      N'nvarchar',  2,  0, 0, 1),
 (N'outh', N'asp_user3', N'nvarchar', 20,  0, 0, 1),
 (N'outh', N'asp_time3', N'datetime2', 8, 27, 7, 1),
 (N'outh', N'订单号',    N'nvarchar', 24,  0, 0, 1),
 (N'outh', N'订单ID',    N'float',     8, 53, 0, 1),
 (N'outh', N'采购单号',  N'nvarchar', 24,  0, 0, 1),
 (N'outh', N'采购ID',    N'float',     8, 53, 0, 1),
 (N'outh', N'工单号',    N'nvarchar', 24,  0, 0, 1),
 (N'outh', N'工单项次',  N'int',       4, 10, 0, 1),
 (N'outh', N'委外单号',  N'nvarchar', 24,  0, 0, 1),
 (N'outh', N'委外ID',    N'float',     8, 53, 0, 1),
 (N'outh', N'审核',      N'nvarchar',  2,  0, 0, 1);

DECLARE @badDef int = 0, @badCmt int = 0, @cinh int, @couth int, @missList nvarchar(400) = N'';

SELECT @badDef = COUNT(*),
       @missList = ISNULL(STUFF((SELECT N',' + e.tbl + N'.' + e.col FROM @expect e
                                 WHERE NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
                                                   WHERE c.object_id = OBJECT_ID(N'dbo.' + e.tbl) AND c.name = e.col
                                                     AND ty.name = e.typ
                                                     AND CASE WHEN ty.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END = e.len
                                                     AND c.precision = e.prec AND c.scale = e.scl
                                                     AND c.is_nullable = e.nullable)
                                 FOR XML PATH(N''), TYPE).value(N'.', N'nvarchar(400)'), 1, 1, N''), N'')
  FROM @expect e
 WHERE NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
                   WHERE c.object_id = OBJECT_ID(N'dbo.' + e.tbl) AND c.name = e.col
                     AND ty.name = e.typ
                     AND CASE WHEN ty.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END = e.len
                     AND c.precision = e.prec AND c.scale = e.scl
                     AND c.is_nullable = e.nullable);

SELECT @badCmt = COUNT(*) FROM @expect e
 WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.class = 1
                     AND ep.major_id = OBJECT_ID(N'dbo.' + e.tbl)
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + e.tbl), e.col, 'ColumnId')
                     AND ep.name = N'MS_Description'
                     AND LEN(LTRIM(RTRIM(CAST(ep.value AS nvarchar(400))))) > 0);

SET @cinh  = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.inh'));
SET @couth = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.outh'));

RAISERROR(N'[自检] inh %d 列 / outh %d 列(应 58/59);22 列定义不符 %d 条[%s];22 条中文注明缺失/空串 %d 条',
          10, 1, @cinh, @couth, @badDef, @missList, @badCmt);
IF @cinh = 58 AND @couth = 59 AND @badDef = 0 AND @badCmt = 0
  RAISERROR(N'[OK] 自检通过:inh/outh 各 +11 列(58/59),类型/长度/可空逐列等于契约(工单项次 int 为有意偏离服务器),22 条中文注明齐备', 10, 1);
ELSE
  RAISERROR(N'[FAIL] 自检异常(见上一行数字):期望 inh 58 / outh 59 列、22 列定义相符、22 条注明非空', 16, 1);
GO
