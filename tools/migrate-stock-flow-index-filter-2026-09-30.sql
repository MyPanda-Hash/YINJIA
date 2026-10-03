-- migrate-stock-flow-index-filter-2026-09-30.sql
-- 任务 1b 收口脚本:① 修索引 NULL 语义 ② 补表级中文注明 ③ 删 RKD/CKD 面板元数据 ④ 删库内备份表
-- 幂等,两个账套都要执行(先 HSDZ_MES,后 HSDZ_MES_TEST)
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════
   ① 唯一索引的 NULL 语义 —— 任务 1 的注释写错了:
      SQL Server 唯一索引**只允许一个 NULL**,而任务 2 要灌多行 (src=0, rid=NULL) 期初,
      实测插第二行即报 2601「不能在具有唯一索引的对象中插入重复键的行。重复键值为 (0, <NULL>)」。
      改为**过滤索引**(WHERE rid IS NOT NULL):可容纳任意多行期初,且仍拦得住重复的 (src,rid)。
      ⚠ 不要回头改任务 1 的脚本(migrate-stock-flow-tables-2026-09-30.sql,已提交 fb422cbf):
        DbSync 按内容哈希判重跑,改它一个字节就会被"重跑"。
   ═══════════════════════════════════════════════════════════════════════ */
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_inh_src_rid' AND has_filter = 0)
BEGIN
  DROP INDEX UX_inh_src_rid ON dbo.inh;
  CREATE UNIQUE INDEX UX_inh_src_rid ON dbo.inh (src, rid) WHERE rid IS NOT NULL;
  PRINT N'[OK] UX_inh_src_rid 已改为过滤索引(WHERE rid IS NOT NULL)';
END
ELSE PRINT N'[SKIP] UX_inh_src_rid 已是过滤索引';
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_outh_src_rid' AND has_filter = 0)
BEGIN
  DROP INDEX UX_outh_src_rid ON dbo.outh;
  CREATE UNIQUE INDEX UX_outh_src_rid ON dbo.outh (src, rid) WHERE rid IS NOT NULL;
  PRINT N'[OK] UX_outh_src_rid 已改为过滤索引(WHERE rid IS NOT NULL)';
END
ELSE PRINT N'[SKIP] UX_outh_src_rid 已是过滤索引';
GO

-- ② 表级中文注明(任务 1 只写了列级;AGENTS《数据库注明》要求新表与关键列都注明)
IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.inh') AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description', N'入库流水(2026-09-30 由遗留纺织表 inh 重建为 MES 语义):一行 = 一张已审核入库单据的一行。与 outh(出库流水) + kucun(结存缓存) 构成三表结构,流水为唯一真源。src/rid 唯一标识来源单据行', N'SCHEMA', N'dbo', N'TABLE', N'inh';
ELSE
  EXEC sp_addextendedproperty N'MS_Description', N'入库流水(2026-09-30 由遗留纺织表 inh 重建为 MES 语义):一行 = 一张已审核入库单据的一行。与 outh(出库流水) + kucun(结存缓存) 构成三表结构,流水为唯一真源。src/rid 唯一标识来源单据行', N'SCHEMA', N'dbo', N'TABLE', N'inh';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.outh') AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description', N'出库流水(2026-09-30 由遗留纺织表 outh 重建为 MES 语义):一行 = 一张已审核出库单据的一行。成本列由 inv_cost_ledger 回填', N'SCHEMA', N'dbo', N'TABLE', N'outh';
ELSE
  EXEC sp_addextendedproperty N'MS_Description', N'出库流水(2026-09-30 由遗留纺织表 outh 重建为 MES 语义):一行 = 一张已审核出库单据的一行。成本列由 inv_cost_ledger 回填', N'SCHEMA', N'dbo', N'TABLE', N'outh';
GO

/* ③ 删 RKD/CKD 面板元数据。
   为什么删:RKD(入库单)/CKD(出库单)是纺织遗留面板,line_table 指向 inh/outh,
   31 行 yj_field 按**旧纺织列名**登记(inh_no/out_date/wzdm/lot_no/sl/ddw…),
   重建后这些列已不存在 ⇒ 面板一打开即报「列名无效」,体检第 05 项因此 +31。
   菜单侧早已未挂(frontend/src 与 menus 无引用),MES 侧也不写这两张面板 ⇒ 孤儿元数据,直接删。
   删后在库内留下的 yj_doc_status 痕迹(6 行)· 面板译名(yj_translation 20 行)也一并清:
   面板已不存在,留着只会让后人以为这两个单据还活着。
   库内无任何外键(2026-09-30 实测 sys.foreign_keys 为 0),故删除顺序无约束。 */
DECLARE @n int = 0;
DELETE FROM yj_role_panel WHERE panel_code IN ('RKD', 'CKD');
SET @n = @n + @@ROWCOUNT;
DELETE FROM yj_field      WHERE panel_code IN ('RKD', 'CKD');
SET @n = @n + @@ROWCOUNT;
DELETE FROM yj_panel      WHERE panel_code IN ('RKD', 'CKD');
SET @n = @n + @@ROWCOUNT;
DELETE FROM yj_doc_status WHERE panel_code IN ('RKD', 'CKD');
SET @n = @n + @@ROWCOUNT;
-- 译名只在「没有别的活面板还叫这个名字」时才删 —— 同中文名在活面板上仍是有效译名键,误删会让它退回机翻
DELETE FROM yj_translation WHERE scope = 'panel' AND ref_key IN (N'入库单', N'出库单')
  AND NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_name = yj_translation.ref_key);
SET @n = @n + @@ROWCOUNT;
IF @n > 0 PRINT N'[OK] RKD/CKD 面板元数据已删(yj_panel/yj_field/yj_role_panel/yj_doc_status/yj_translation 共 ' + CAST(@n AS nvarchar(10)) + N' 行)';
ELSE PRINT N'[SKIP] RKD/CKD 面板元数据已不存在';
GO

/* ④ 删库内备份表 —— 数据已导出为 tools/archive/_stock-flow-backup-20260930.csv
      (inh_bak_20260930 145 行 / 115 列、outh_bak_20260930 30 行 / 126 列,导出后逐表核对行数一致)。
      为什么要删:体检第 10 项(备份/临时表)的棘轮基线已于 2026-09-29 收到 0,「再出现即 FAIL」;
      留着这两张表 = 体检永久 FAIL-2。老数据另有 CSV 抓手,故从库内删除。
      ⚠ 顺序红线:必须先导出 CSV 并核对行数,确认无误后才允许跑本段。 */
IF OBJECT_ID('dbo.inh_bak_20260930') IS NOT NULL
BEGIN
  DROP TABLE dbo.inh_bak_20260930;
  PRINT N'[OK] inh_bak_20260930 已删(CSV 备份在 tools/archive/_stock-flow-backup-20260930.csv)';
END
ELSE PRINT N'[SKIP] inh_bak_20260930 已不存在';
IF OBJECT_ID('dbo.outh_bak_20260930') IS NOT NULL
BEGIN
  DROP TABLE dbo.outh_bak_20260930;
  PRINT N'[OK] outh_bak_20260930 已删(CSV 备份在 tools/archive/_stock-flow-backup-20260930.csv)';
END
ELSE PRINT N'[SKIP] outh_bak_20260930 已不存在';
GO

-- ⑤ 自检
DECLARE @ok int = 0;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_inh_src_rid' AND has_filter = 1) SET @ok = @ok + 1;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_outh_src_rid' AND has_filter = 1) SET @ok = @ok + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code IN ('RKD','CKD')) SET @ok = @ok + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code IN ('RKD','CKD')) SET @ok = @ok + 1;
IF NOT EXISTS (SELECT 1 FROM yj_doc_status WHERE panel_code IN ('RKD','CKD')) SET @ok = @ok + 1;
IF OBJECT_ID('dbo.inh_bak_20260930') IS NULL SET @ok = @ok + 1;
IF OBJECT_ID('dbo.outh_bak_20260930') IS NULL SET @ok = @ok + 1;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.inh') AND minor_id = 0 AND name = 'MS_Description') SET @ok = @ok + 1;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.outh') AND minor_id = 0 AND name = 'MS_Description') SET @ok = @ok + 1;
IF @ok = 9 PRINT N'[OK] 自检通过(9/9)'; ELSE PRINT N'[FAIL] 自检异常:' + CAST(@ok AS nvarchar(3)) + N'/9';
GO
