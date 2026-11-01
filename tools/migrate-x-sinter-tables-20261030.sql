/* ============================================================================
   migrate-x-sinter-tables-20261030.sql
   X烧结工艺清单（RD_X_SINTER）建表 —— 2026-10-30

   【需求来源·用户原话】
     「现在要对研发管理的成型工艺清单面板进行一个调整升级……需要在原成型工艺清单下面设置：
       X烧结工艺清单，烧结工艺清单入口，两个入口在产品文件里面是属于同一份文件，只是模板不一样」
     「新加的面板X烧结面板就2页：1.X烧结配方工艺管控清单  2.修订记录」
   设计依据：《X烧结工单模板-261029.xlsx》（模板）
             《T205-X冰箱炭棒-26102901.xlsx》（真实单据，用于验证计算器）

   【为什么新开两张表而不是复用 rd_mold_proc_*】
     现有「成型工艺清单 RD_MOLD_PROC」是 3 页（成型工艺清单/成型配方/修订记录），
     承载的是**另一套版式**（灌料/烧结/热压/冷却/脱模…按工序分段）。X烧结这份是
     **配方计算器驱动**的单页工艺卡（配方表 10 行 + 成型管控要求 5 段），
     两者字段重合度极低、页数不同 ⇒ 独立成表，避免往 60+ 列的既有头表继续加字段。
     现有面板只改**显示名**为「烧结工艺清单」，panel_code 不动
     （全前端 94 处引用 RD_MOLD_PROC，改 code 会连锁 403/参照断链）。

   【表结构要点】
     · rd_x_sinter_head  = 产品基本信息 + 模具参数 + 计算器输出 + 三段管控要求
     · rd_x_sinter_detail= 表区区分「配方表」(10 行物料) 与「修订记录」
     · 计算字段**一律落库**（保存时前端算好后提交）：历史单据的数值不会因日后改公式而变动，
       打印出来与当年审批的一致。这一点与配方计算器实现（Vue 端算）配套。
     · 输入参数与输出值分开命名：输入 `密度参数下限/上限`，
       输出 `密度要求下限/中间值/上限` —— 两者在纸面上同一段但语义不同（0.55 / 0.595）。

   ⚠ 两账套都要跑（先 HSDZ_MES 后 HSDZ_MES_TEST），已登记 tools/db-migrations.txt。
   ⚠ 新表已登记 docs/development/数据库表清单.md 与 tools/db-inuse-tables.txt。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @db sysname = DB_NAME();

/* ══════════════════════════════════════════════════════════════════════
   1) 头表 rd_x_sinter_head
   ══════════════════════════════════════════════════════════════════════ */
IF OBJECT_ID('rd_x_sinter_head') IS NULL
BEGIN
    CREATE TABLE rd_x_sinter_head (
        id                    int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [单据编号]            nvarchar(50)  NULL,
        [单据日期]            nvarchar(20)  NULL,
        /* ── 信息栏（纸面右上四格）── */
        [表单管理人]          nvarchar(50)  NULL,
        [密级]                nvarchar(50)  NULL,
        [使用范围]            nvarchar(100) NULL,
        [版本号]              nvarchar(50)  NULL,
        /* ── 一、产品基本信息 ── */
        [产品编号]            nvarchar(50)  NULL,
        [炭棒编号]            nvarchar(50)  NULL,
        [产品名称]            nvarchar(100) NULL,
        [炭棒外径]            nvarchar(20)  NULL,
        [炭棒内径]            nvarchar(20)  NULL,
        [炭棒出货长度]        nvarchar(20)  NULL,
        [产品管控类型]        nvarchar(50)  NULL,
        [产品形态]            nvarchar(50)  NULL,
        [生产车间]            nvarchar(50)  NULL,
        /* ── 计算器输入参数（纸面不直接印，供重算/追溯）── */
        [模具出料口内径]      nvarchar(20)  NULL,
        [中心杆外径]          nvarchar(20)  NULL,
        [炭棒外径公差]        nvarchar(20)  NULL,
        [炭棒内径公差]        nvarchar(20)  NULL,
        [颗粒物料折算系数]    nvarchar(20)  NULL,
        [成型修正长度参数mm]  nvarchar(20)  NULL,
        [密度参数下限]        nvarchar(20)  NULL,
        [密度参数上限]        nvarchar(20)  NULL,
        /* ── 计算器输出（纸面「成型管控要求」五段）── */
        [切炭长度下限mm]      nvarchar(20)  NULL,
        [切炭长度中间值mm]    nvarchar(20)  NULL,
        [切炭长度上限mm]      nvarchar(20)  NULL,
        [冷却长度下限mm]      nvarchar(20)  NULL,
        [冷却长度中间值mm]    nvarchar(20)  NULL,
        [冷却长度上限mm]      nvarchar(20)  NULL,
        [炭棒重量下限g]       nvarchar(20)  NULL,
        [炭棒重量中间值g]     nvarchar(20)  NULL,
        [炭棒重量上限g]       nvarchar(20)  NULL,
        [密度要求下限]        nvarchar(20)  NULL,
        [密度要求中间值]      nvarchar(20)  NULL,
        [密度要求上限]        nvarchar(20)  NULL,
        /* ── 文本段 ── */
        [配料要求]            nvarchar(500) NULL,
        [特殊管控要求]        nvarchar(1000) NULL,
        [备注]                nvarchar(500) NULL,
        [变更来源单号]        nvarchar(50)  NULL,
        /* ── 系统列（全库统一）── */
        asp_user1             nvarchar(50)  NULL,
        asp_time1             datetime2     NULL,
        asp_user2             nvarchar(50)  NULL,
        asp_time2             datetime2     NULL,
        asp_cancel            char(1)       NULL DEFAULT 'N',
        备用1  nvarchar(200) NULL, 备用2  nvarchar(200) NULL, 备用3  nvarchar(200) NULL,
        备用4  nvarchar(200) NULL, 备用5  nvarchar(200) NULL, 备用6  nvarchar(200) NULL,
        备用7  nvarchar(200) NULL, 备用8  nvarchar(200) NULL, 备用9  nvarchar(200) NULL,
        备用10 nvarchar(200) NULL, 备用11 nvarchar(200) NULL, 备用12 nvarchar(200) NULL,
        备用13 nvarchar(200) NULL, 备用14 nvarchar(200) NULL, 备用15 nvarchar(200) NULL,
        备用16 nvarchar(200) NULL, 备用17 nvarchar(200) NULL, 备用18 nvarchar(200) NULL,
        备用19 nvarchar(200) NULL, 备用20 nvarchar(200) NULL
    );
    CREATE INDEX IX_rd_x_sinter_head_no ON rd_x_sinter_head([单据编号]);
    PRINT N'[OK] 建表 rd_x_sinter_head';
END
ELSE PRINT N'[SKIP] rd_x_sinter_head 已存在';

/* ══════════════════════════════════════════════════════════════════════
   2) 明细表 rd_x_sinter_detail（表区区分 配方表 / 修订记录）
   ══════════════════════════════════════════════════════════════════════ */
IF OBJECT_ID('rd_x_sinter_detail') IS NULL
BEGIN
    CREATE TABLE rd_x_sinter_detail (
        id                int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [单据编号]        nvarchar(50)  NULL,
        [表区]            nvarchar(50)  NULL,   /* 配方表 | 修订记录 */
        [序号]            nvarchar(10)  NULL,
        /* ── 配方表列（对应打印模板 A10:L20）── */
        [物料种类]        nvarchar(50)  NULL,
        [物料编号]        nvarchar(50)  NULL,
        [物料名称]        nvarchar(100) NULL,
        [设计添加量]      nvarchar(20)  NULL,   /* 计算器 E 列，审计用，纸面不印 */
        [添加比例]        nvarchar(20)  NULL,   /* 计算器 G 列 → 纸面 K 列 */
        [单支含量g]       nvarchar(20)  NULL,   /* 计算器 H 列 → 纸面 L 列 */
        /* ── 修订记录列 ── */
        [更改内容]        nvarchar(500) NULL,
        [更改原因]        nvarchar(500) NULL,
        [更改时间]        nvarchar(50)  NULL,
        [责任人]          nvarchar(50)  NULL,
        [备注]            nvarchar(500) NULL,
        asp_user1         nvarchar(50)  NULL,
        asp_time1         datetime2     NULL,
        asp_user2         nvarchar(50)  NULL,
        asp_time2         datetime2     NULL,
        asp_cancel        char(1)       NULL DEFAULT 'N',
        备用1  nvarchar(200) NULL, 备用2  nvarchar(200) NULL, 备用3  nvarchar(200) NULL,
        备用4  nvarchar(200) NULL, 备用5  nvarchar(200) NULL, 备用6  nvarchar(200) NULL,
        备用7  nvarchar(200) NULL, 备用8  nvarchar(200) NULL, 备用9  nvarchar(200) NULL,
        备用10 nvarchar(200) NULL, 备用11 nvarchar(200) NULL, 备用12 nvarchar(200) NULL,
        备用13 nvarchar(200) NULL, 备用14 nvarchar(200) NULL, 备用15 nvarchar(200) NULL,
        备用16 nvarchar(200) NULL, 备用17 nvarchar(200) NULL, 备用18 nvarchar(200) NULL,
        备用19 nvarchar(200) NULL, 备用20 nvarchar(200) NULL
    );
    CREATE INDEX IX_rd_x_sinter_detail_no ON rd_x_sinter_detail([单据编号], [表区]);
    PRINT N'[OK] 建表 rd_x_sinter_detail';
END
ELSE PRINT N'[SKIP] rd_x_sinter_detail 已存在';

/* ══════════════════════════════════════════════════════════════════════
   3) 表注释（AGENTS.md：新建表必须带中文注明）
   ══════════════════════════════════════════════════════════════════════ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id=OBJECT_ID('rd_x_sinter_head') AND minor_id=0 AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'X烧结工艺清单-头（研发管理）。配方计算器驱动的单页工艺卡：产品基本信息+模具参数+计算输出+管控要求。',
        'SCHEMA','dbo','TABLE','rd_x_sinter_head';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id=OBJECT_ID('rd_x_sinter_detail') AND minor_id=0 AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'X烧结工艺清单-明细。表区=N''配方表''为物料配方10行；表区=N''修订记录''为版本变更留痕。',
        'SCHEMA','dbo','TABLE','rd_x_sinter_detail';

/* 关键列注释 */
DECLARE @colComments TABLE (tbl sysname, col sysname, txt nvarchar(500));
INSERT INTO @colComments VALUES
 ('rd_x_sinter_head', N'模具出料口内径',   N'X烧结模具对应炭棒公差表带入：挤出头内径'),
 ('rd_x_sinter_head', N'中心杆外径',       N'X烧结模具对应炭棒公差表带入：中心杆外径'),
 ('rd_x_sinter_head', N'炭棒外径公差',     N'X烧结模具对应炭棒公差表带入'),
 ('rd_x_sinter_head', N'炭棒内径公差',     N'X烧结模具对应炭棒公差表带入'),
 ('rd_x_sinter_head', N'颗粒物料折算系数', N'配方计算器输入参数（模板默认0.65），用于折算物料重量'),
 ('rd_x_sinter_head', N'成型修正长度参数mm', N'配方计算器输入参数（模板默认0.5），切割长度中间值=出货长度+该值'),
 ('rd_x_sinter_head', N'密度参数下限',     N'配方计算器输入参数（模板默认0.55 g/cm3）'),
 ('rd_x_sinter_head', N'密度参数上限',     N'配方计算器输入参数（模板默认0.64 g/cm3）'),
 ('rd_x_sinter_head', N'切炭长度下限mm',   N'计算输出：切割长度中间值-成型修正长度参数'),
 ('rd_x_sinter_head', N'切炭长度中间值mm', N'计算输出：炭棒出货长度+成型修正长度参数'),
 ('rd_x_sinter_head', N'切炭长度上限mm',   N'计算输出：切割长度中间值+成型修正长度参数'),
 ('rd_x_sinter_head', N'冷却长度下限mm',   N'计算输出：切炭长度下限-成型修正长度参数'),
 ('rd_x_sinter_head', N'冷却长度中间值mm', N'计算输出：切炭长度中间值-成型修正长度参数'),
 ('rd_x_sinter_head', N'冷却长度上限mm',   N'计算输出：切炭长度上限-成型修正长度参数'),
 ('rd_x_sinter_head', N'炭棒重量下限g',    N'计算输出：炭棒体积×密度参数下限'),
 ('rd_x_sinter_head', N'炭棒重量中间值g',  N'计算输出：炭棒体积×密度中值'),
 ('rd_x_sinter_head', N'炭棒重量上限g',    N'计算输出：炭棒体积×密度参数上限'),
 ('rd_x_sinter_head', N'密度要求下限',     N'计算输出：=密度参数下限'),
 ('rd_x_sinter_head', N'密度要求中间值',   N'计算输出：=(密度参数下限+密度参数上限)/2'),
 ('rd_x_sinter_head', N'密度要求上限',     N'计算输出：=密度参数上限'),
 ('rd_x_sinter_detail', N'表区',           N'分区值：配方表 / 修订记录（同一张明细表靠它分表）'),
 ('rd_x_sinter_detail', N'设计添加量',     N'配方计算器 E 列。粉料1/胶粉1 为倒推值，其余为人工输入。纸面不印，留作审计'),
 ('rd_x_sinter_detail', N'添加比例',       N'配方计算器 G 列（实际添加比例），纸面「添加比例%」'),
 ('rd_x_sinter_detail', N'单支含量g',      N'配方计算器 H 列（物料重量），纸面「单支含量g」');

DECLARE @t sysname, @c sysname, @t2 nvarchar(500);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, txt FROM @colComments;
OPEN cur;
FETCH NEXT FROM cur INTO @t, @c, @t2;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                    WHERE major_id=OBJECT_ID(@t) AND minor_id=COLUMNPROPERTY(OBJECT_ID(@t), @c, 'ColumnId')
                      AND name=N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @t2, 'SCHEMA','dbo','TABLE',@t,'COLUMN',@c;
    FETCH NEXT FROM cur INTO @t, @c, @t2;
END
CLOSE cur; DEALLOCATE cur;

/* ══════════════════════════════════════════════════════════════════════
   4) 自检：两表都在 + 关键列齐
   ══════════════════════════════════════════════════════════════════════ */
DECLARE @h int = COL_LENGTH('rd_x_sinter_head', N'切炭长度中间值mm');
DECLARE @d int = COL_LENGTH('rd_x_sinter_detail', N'单支含量g');
DECLARE @tabs int = CASE WHEN OBJECT_ID('rd_x_sinter_head') IS NOT NULL THEN 1 ELSE 0 END
                       + CASE WHEN OBJECT_ID('rd_x_sinter_detail') IS NOT NULL THEN 1 ELSE 0 END;

PRINT N'[DB] ' + @db;
PRINT N'[OK] 表 ' + CAST(@tabs AS nvarchar(5)) + N'/2,头表关键列=' + ISNULL(CAST(@h AS nvarchar(10)), N'NULL')
    + N',明细表关键列=' + ISNULL(CAST(@d AS nvarchar(10)), N'NULL');

IF @tabs <> 2 OR @h IS NULL OR @d IS NULL
BEGIN
    ROLLBACK TRAN;
    RAISERROR(N'[FAIL] %s:X烧结表结构未齐备,已回滚', 16, 1, @db);
    RETURN;
END

COMMIT TRAN;
PRINT N'[SELF-CHECK OK] X烧结工艺清单两张表就绪';
