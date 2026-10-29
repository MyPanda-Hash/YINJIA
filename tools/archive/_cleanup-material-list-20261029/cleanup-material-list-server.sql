/* =============================================================================
   cleanup-material-list-server-20261029.sql
   -----------------------------------------------------------------------------
   用户口径(2026-10-29):「把服务器上的物料清单的数据全部清理掉」
   用户明确选择:**确认全部删除、不需要备份**。

   ── 执行环境 ──────────────────────────────────────────────────────────────
   目标:**服务器 36.140.66.163**(公网 8090 / RDP 3389),库 HSDZ_MES。
   本文档由用户在服务器 SSMS 里手动执行(1433 不对外,无命令行直连通道)。
   ⚠ 本机(开发机)库**不要执行** —— 除非你也想清本地研发数据。

   ── 清理对象:只有一张表 ─────────────────────────────────────────────────
   yj_panel 里 WLBOM(物料清单)是**单表式面板**:
       panel_code=WLBOM  head_table=NULL  line_table=mate  mode=doc
   ⇒ 头与明细**都在 mate 一张表**里(旧行表,一行 = 一个「产品 + 子件」),
     没有独立的 _head/_detail 附表,清 mate 即清空面板全部数据。

   拍照于 2026-10-29 的服务器现状(只读取证):
       物料清单面板 totalSize = 6655 张单
       抽样 1200 行:物料名称 ≡ 物料编码、明细全空、单据状态全草稿、
       单据日期 2025-05-30 —— 批量导入的占位数据,非真实 BOM。

   ── 幂等 ─────────────────────────────────────────────────────────────────
   带行数守卫与前后计数;重复执行只是再删一遍(第二次删 0 行)。无 DELETE 之外的写操作。
   不删表、不动 yj_panel / yj_field 元数据(面板本身要留着,以后还要录真实 BOM)。
   ============================================================================= */
SET NOCOUNT ON;
GO

/* ---------- ① 删除前:现状拍照(先看数,再决定删不删) ---------- */
PRINT '=== 删除前 mate 现状 ===';
SELECT COUNT(*) AS 总行数,
       COUNT(DISTINCT m_no) AS 不同产品数,
       MIN(m_date) AS 最早日期,
       MAX(m_date) AS 最晚日期
FROM dbo.mate;
GO
SELECT TOP 3 m_no AS 产品编号, wzdm2 AS 子件代码, wzmc2 AS 子件名称, gg2 AS 规格, bzl AS 标准用量, asp_cancel
FROM dbo.mate ORDER BY m_no;
GO

/* ---------- ② 正式删除:清空 mate ---------- */
DECLARE @n int;
DELETE FROM dbo.mate;
SET @n = @@ROWCOUNT;
PRINT N'[OK] 已删除 mate 行数: ' + CAST(@n AS nvarchar(12));
GO

/* ---------- ③ 自检:必须为 0 ---------- */
DECLARE @left int = (SELECT COUNT(*) FROM dbo.mate);
IF @left <> 0
    RAISERROR(N'清理未完成:mate 仍有 %d 行', 16, 1, @left);
ELSE
    PRINT N'[PASS] mate 已清空(0 行),物料清单面板现在应该是空的';
GO

/* ---------- ④ 面板本身保留(确认元数据没被误删) ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'WLBOM')
    RAISERROR(N'异常:WLBOM 面板元数据消失了(本脚本不应改动 yj_panel)', 16, 1);
ELSE
    PRINT N'[PASS] WLBOM 面板元数据仍在(物料清单入口保留,可继续录真实 BOM)';
GO
PRINT N'cleanup-material-list-server-20261029.sql 完成';
GO
