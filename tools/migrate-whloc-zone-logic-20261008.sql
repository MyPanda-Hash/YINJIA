-- migrate-whloc-zone-logic-20261008.sql — 仓库/仓位字段逻辑按「厂区 > 仓(A/B/C/D) > 大区 > 分区」重构
--
-- 【用户口径 2026-10-08】原文:
--   ① 「最大的是厂区然后是仓,各个仓分为ABCD四个仓,而当前老厂区分为三个仓,A仓中分为两个大区
--      原料区和辅料及配件区。B仓位一个成品仓,C仓位一个成品仓,就不再分区。
--      而D仓就为整个新厂区的都是D仓,底下分区为成品仓区,原料区,辅料及配料区。」
--   ② 补充澄清:「D仓是和新厂区并列的,意味厂区分区意义不大,根据仓库分即可;但是又要展现厂区的分别。
--      按照你的分四层也可以,但是意味着**厂区应该是在仓库表而不是仓位表**。」
--
-- 【目标层次】(四层,自顶向下)
--   厂区 ─ 仓 ─ 大区 ─ 分区 ─ 区码 ─ 排号 ─ 位号 ─ 层号
--   ⚠ **厂区/仓 两层的属性落在 `bs_wh`(仓库表)**;`bs_wh_loc`(仓位表)只从 大区 往下,
--     不再冗余 厂区(D仓 本身就等同新厂区,厂区由 仓库编码 关联 bs_wh 取得)。
--   老厂区 · A仓 · 原料区        · 炭粉区/胶粉区/货架区
--   老厂区 · A仓 · 辅料及配件区  · 纸箱区/端盖区/PP棉区/无纺布区/网套区/标签区
--   老厂区 · B仓 · (不再分区)
--   老厂区 · C仓 · (不再分区)
--   新厂区 · D仓 · 成品仓区      · (成品不再细分)
--                · 原料区        · 炭粉区/胶粉区…(新厂区原料仓位尚未建,编码规则待业务给)
--                · 辅料及配料区  · 纸箱区/端盖区…(同上)
--
-- 【本次改动】
--   1. `bs_wh` 加 `厂区`(厂区/仓 都在仓库表);四个仓归位并正名 A仓/B仓/C仓/D仓
--   2. `bs_wh_loc` 加 `大区`;**移除 `bs_wh_loc.厂区`**(yj_field 行 + 物理列,厂区归仓库表)
--   3. A仓 的 CK-A2 那批并入 CK-A(A仓 = 原料区 + 辅料及配件区)
--   4. 回填 大区/存储分区:B/C 仓不再分区(清空 存储分区);D仓成品 大区=成品仓区
--   5. 仓位表冗余的 仓库(名称快照) 随 bs_wh 改名同步;仓位地址按新层次(含大区)重算
--   6. yj_field:WHLOC 加 `大区`、删 `厂区`、按层次重排序号;WH 加 `厂区`;补九语言译名
--
-- 【⚠ 改名连带影响(已处理/需知悉)】
--   · ButtonService:2333/2596 用 `仓库名称 LIKE N'%成品%' OR 仓库分类 LIKE N'%成品%'` 兜底选默认成品仓
--     ⇒ 本脚本给 B/C/D 三个成品仓同时写 `仓库分类 = N'成品'`,改裸名后该兜底仍命中。
--   · CP-02 是金蝶同步来源(asp_user1='jdy-sync')。本仓库代码内**没有** bs_wh 的金蝶同步,
--     故不会被自动覆盖;但若仓外同步工具按 编码 回写 名称,可能被还原(届时改回 B仓 即可)。
--   · StockLedgerService/QcDisposalService 会按 `仓库名称` 反查 `仓库编码` —— 影响的是
--     **改名前录入、改名后才审核**的单据;存量流水存的是编码(inh/outh/kucun 用 CP-02),不受影响。
--   · CK-A2 仓库档案**停用不删**(保留追溯),其 103 个仓位改挂 CK-A。
--   · ⚠ 迁移链顺序:本脚本 DROP 掉 `bs_wh_loc.厂区`,而链条前序的
--     migrate-whloc-area-a-raw / migrate-whloc-rest 的 INSERT 列清单里还带 `厂区`。
--     两者内容哈希未变、不会重跑;全新库按链顺序走(先建列→灌数→本脚本 DROP)结果一致。
--     若将来要改那两个脚本,须先摘掉其中的 `厂区` 列。
--
-- 【幂等】加列按 COL_LENGTH;DROP 按 COL_LENGTH 判存在;UPDATE 全为确定性赋值;字段按 col_name;
--   译名按 (scope,ref_key,locale)。可重复执行(复跑 = 全 no-op)。
-- 【执行】两个账套都要跑(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

-- ══════════ 1. bs_wh 加 `厂区`(仓库的属性:厂区 > 仓) ══════════
IF COL_LENGTH('dbo.bs_wh', N'厂区') IS NULL ALTER TABLE dbo.bs_wh ADD [厂区] nvarchar(20) NULL;
IF COL_LENGTH('dbo.bs_wh', N'厂区') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
  WHERE ep.major_id=OBJECT_ID('dbo.bs_wh') AND ep.class=1 AND ep.name='MS_Description' AND c.name=N'厂区')
  EXEC sp_addextendedproperty N'MS_Description',
    N'厂区(老厂区/新厂区;层次最上层,厂区 > 仓;2026-10-08 按用户口径新增)',
    N'SCHEMA',N'dbo',N'TABLE',N'bs_wh',N'COLUMN',N'厂区';
GO

-- ══════════ 2. 四个仓归位(A/B/C/D) ══════════
-- CK-A 原料区+辅料及配件区 → A仓
UPDATE dbo.bs_wh SET 仓库名称=N'A仓', 厂区=N'老厂区', 仓库类型=N'原料辅料仓', 仓库分类=N'原料'
WHERE 仓库编码=N'CK-A';
-- CP-02 成品B仓 → B仓(同时写 仓库分类='成品',兜住 ButtonService 的 LIKE 兜底)
UPDATE dbo.bs_wh SET 仓库名称=N'B仓', 厂区=N'老厂区', 仓库类型=N'成品仓', 仓库分类=N'成品'
WHERE 仓库编码=N'CP-02';
-- CK-C 成品C仓 → C仓
UPDATE dbo.bs_wh SET 仓库名称=N'C仓', 厂区=N'老厂区', 仓库类型=N'成品仓', 仓库分类=N'成品'
WHERE 仓库编码=N'CK-C';
-- CK-D 成品D仓 → D仓(整个新厂区)
UPDATE dbo.bs_wh SET 仓库名称=N'D仓', 厂区=N'新厂区', 仓库类型=N'成品仓', 仓库分类=N'成品'
WHERE 仓库编码=N'CK-D';
-- CK-A2 并入 A仓:停用(不删,保留追溯)
UPDATE dbo.bs_wh SET 停用=1, 状态=N'停用', 备注=ISNULL(备注,N'')+N' [2026-10-08 并入 A仓(CK-A),本档停用]'
WHERE 仓库编码=N'CK-A2';
GO

-- ══════════ 3. bs_wh_loc 加 `大区`,并把 CK-A2 的仓位并入 CK-A ══════════
IF COL_LENGTH('dbo.bs_wh_loc', N'大区') IS NULL ALTER TABLE dbo.bs_wh_loc ADD [大区] nvarchar(30) NULL;
IF COL_LENGTH('dbo.bs_wh_loc', N'大区') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
  WHERE ep.major_id=OBJECT_ID('dbo.bs_wh_loc') AND ep.class=1 AND ep.name='MS_Description' AND c.name=N'大区')
  EXEC sp_addextendedproperty N'MS_Description',
    N'大区(仓内的大功能分区,层次:厂区 > 仓 > 大区 > 分区;取值 原料区/辅料及配件区/成品仓区;B仓/C仓 不分区故为空;2026-10-08 按用户口径新增)',
    N'SCHEMA',N'dbo',N'TABLE',N'bs_wh_loc',N'COLUMN',N'大区';

DECLARE @mv int;
UPDATE dbo.bs_wh_loc SET 仓库编码=N'CK-A', 仓库=N'A仓'
WHERE 仓库编码=N'CK-A2' AND ISNULL(asp_cancel,'N')<>'Y';
SET @mv = @@ROWCOUNT;
PRINT N'  ✓ CK-A2 仓位并入 A仓 ' + CAST(@mv AS nvarchar(10)) + N' 行';
GO

-- ══════════ 4. 回填 `大区` / `存储分区`(按用户口径;B/C仓不再分区) ══════════
DECLARE @n1 int, @n2 int, @n3 int, @n4 int;

-- 4.1 A仓 原料区:炭粉区/胶粉区/货架区
UPDATE dbo.bs_wh_loc SET 大区=N'原料区'
WHERE 仓库编码=N'CK-A' AND 存储分区 IN (N'炭粉区', N'胶粉区', N'货架区') AND ISNULL(asp_cancel,'N')<>'Y';
SET @n1 = @@ROWCOUNT;

-- 4.2 A仓 辅料及配件区:纸箱区/端盖区/PP棉区/无纺布区/网套区/标签区
UPDATE dbo.bs_wh_loc SET 大区=N'辅料及配件区'
WHERE 仓库编码=N'CK-A' AND 存储分区 IN (N'纸箱区', N'端盖区', N'PP棉区', N'无纺布区', N'网套区', N'标签区') AND ISNULL(asp_cancel,'N')<>'Y';
SET @n2 = @@ROWCOUNT;

-- 4.3 B仓/C仓:一个成品仓,不再分区 ⇒ 大区与存储分区都清空(仓库自身即成品仓)
UPDATE dbo.bs_wh_loc SET 大区=NULL, 存储分区=NULL
WHERE 仓库编码 IN (N'CP-02', N'CK-C') AND ISNULL(asp_cancel,'N')<>'Y';
SET @n3 = @@ROWCOUNT;

-- 4.4 D仓:底下分区为 成品仓区/原料区/辅料及配件区。本脚本执行时 D仓 只有成品仓位 ⇒ 大区=成品仓区,存储分区清空。
-- ⚠ **必须只圈成品仓位**(编码形如 D1-01-1 / D11-08-2,即 D+数字 开头),不能写成 `WHERE 仓库编码=N'CK-D'` 全表刷 ——
--   否则后续批次补进的 原料区/辅料及配件区 会被一并刷掉。2026-10-08 实测就踩到了:
--   DbSync 因本脚本字节变更重跑一次,把已补的 504(原料区)+118(辅料及配件区) 行 大区 全刷成了 成品仓区。
UPDATE dbo.bs_wh_loc SET 大区=N'成品仓区', 存储分区=NULL
WHERE 仓库编码=N'CK-D' AND 仓位编码 LIKE N'D[0-9]%-%' AND ISNULL(asp_cancel,'N')<>'Y';
SET @n4 = @@ROWCOUNT;

PRINT N'  ✓ 大区回填:原料区 ' + CAST(@n1 AS nvarchar(10)) + N' 行 / 辅料及配件区 ' + CAST(@n2 AS nvarchar(10))
    + N' 行 / B·C仓去分区 ' + CAST(@n3 AS nvarchar(10)) + N' 行 / D仓成品仓区 ' + CAST(@n4 AS nvarchar(10)) + N' 行';
GO

-- ══════════ 5. 仓位表冗余列同步 + 仓位地址按新层次重算 ══════════
-- ⚠ 仓位表有两列冗余:仓库编码(外键)/仓库(名称快照)。改了 bs_wh 的名称必须同步刷 仓库,
--   否则面板按「仓库」显示的还是旧名(本脚本初版就漏了这一步,已补)。
-- ⚠ 厂区**不在此处同步** —— 按用户口径厂区归仓库表,仓位表不再持有该列(见 §6)。
DECLARE @n5b int, @n6 int;
UPDATE l SET l.仓库 = w.仓库名称
FROM dbo.bs_wh_loc l JOIN dbo.bs_wh w ON w.仓库编码 = l.仓库编码
WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND w.仓库名称 IS NOT NULL
  AND ISNULL(l.仓库,N'') <> ISNULL(w.仓库名称,N'');
SET @n5b = @@ROWCOUNT;

-- ⚠ 地址公式必须 NULL 安全:新厂区那批「只有序号、没有排」的仓位 排号 为 NULL,
--   而 T-SQL 的 `+` 遇 NULL 会把整条结果算成 NULL ⇒ 地址会整批变空。故 排号 段改成 CASE 显式判断。
UPDATE dbo.bs_wh_loc SET
  仓位地址 = ISNULL(大区,N'') + ISNULL(存储分区,N'')
             -- 区码 与 存储分区 同义时(如 纸箱区/纸箱区、网套布区/网套&布区)不重复写一遍
             + CASE WHEN REPLACE(ISNULL(区码,N''),N'&','') <> REPLACE(ISNULL(存储分区,N''),N'&','')
                    THEN ISNULL(区码,N'') ELSE N'' END
             -- 有排号 = 老厂区式「<区码>-<排>排<位>位」;无排号 = 新厂区序号式「<区码>-<位>位」
             -- (无排号时那一横必须有:否则 炭粉区3 + 36位 会黏成 炭粉区336位 产生歧义)
             + CASE WHEN 排号 IS NOT NULL AND 排号 <> N''
                    THEN N'-' + 排号 + N'排' + 位号 + N'位'
                    ELSE N'-' + 位号 + N'位' END
             + ISNULL(层号 + N'层', N'')
WHERE ISNULL(asp_cancel,'N')<>'Y'
  AND ISNULL(区码,N'')<>N'' AND ISNULL(位号,N'')<>N'';
SET @n6 = @@ROWCOUNT;
PRINT N'  ✓ 仓库名对齐 ' + CAST(@n5b AS nvarchar(10)) + N' 行 / 仓位地址重算 ' + CAST(@n6 AS nvarchar(10)) + N' 行';
GO

-- ══════════ 6. 移除 `bs_wh_loc.厂区`(厂区归仓库表,仓位表不再冗余) ══════════
-- 用户口径 2026-10-08:「厂区应该是在仓库表而不是仓位表」。
-- 先删 yj_field 登记行(否则面板会 select 一个不存在的列 ⇒ 列名无效),再 DROP 物理列。
DELETE FROM yj_field WHERE panel_code='WHLOC' AND col_name=N'厂区';
IF COL_LENGTH('dbo.bs_wh_loc', N'厂区') IS NOT NULL
BEGIN
  -- DROP COLUMN 前先摘掉该列上的扩展属性(DROP 会自动带走,这里显式留痕便于排查)
  DECLARE @cid int = COLUMNPROPERTY(OBJECT_ID('dbo.bs_wh_loc'), N'厂区', 'ColumnId');
  IF @cid IS NOT NULL AND EXISTS (SELECT 1 FROM sys.extended_properties
        WHERE major_id=OBJECT_ID('dbo.bs_wh_loc') AND minor_id=@cid AND class=1 AND name='MS_Description')
    EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA',N'dbo',N'TABLE',N'bs_wh_loc',N'COLUMN',N'厂区';
  ALTER TABLE dbo.bs_wh_loc DROP COLUMN [厂区];
  PRINT N'  ✓ 已移除 bs_wh_loc.厂区(厂区改由 bs_wh.厂区 承载)';
END
ELSE PRINT N'  · bs_wh_loc.厂区 已不存在,跳过';
GO

-- ══════════ 7. yj_field:WHLOC 加 `大区`、删 `厂区`、按层次重排序号;WH 加 `厂区` ══════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WHLOC' AND col_name=N'大区')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WHLOC', N'大区', N'大区', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 34, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'厂区')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WH', N'厂区', N'厂区', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 36, 100, 1, 0, 0, 1);

-- WHLOC 列序按层次自顶向下(厂区已移出本表):
--   仓库 > 仓位编码 > 大区 > 存储分区 > 区码 > 排号 > 位号 > 层号 > 仓位地址 > 停用 > 备注
UPDATE yj_field SET seq = v.seq FROM yj_field f
JOIN (VALUES (N'仓库',10),(N'仓库编码',20),(N'仓位编码',30),(N'大区',34),(N'存储分区',36),
             (N'区码',38),(N'排号',40),(N'位号',42),(N'层号',44),(N'仓位地址',50),(N'停用',60),(N'备注',70)) v(col,seq)
  ON f.col_name = v.col
WHERE f.panel_code='WHLOC';
GO

-- ══════════ 8. 译名(WHLOC.大区 9 条;WH.厂区 复用已有 field/厂区,无需插) ══════════
DECLARE @trn int;
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', t.ref_key, t.locale, t.text, 'manual'
FROM (VALUES
 (N'大区','en',N'Major Zone'),      (N'大区','ja',N'大エリア'),        (N'大区','ko',N'대구역'),
 (N'大区','de',N'Hauptbereich'),    (N'大区','es',N'Zona principal'),  (N'大区','fr',N'Zone principale'),
 (N'大区','ru',N'Основная зона'),   (N'大区','th',N'พื้นที่หลัก'),      (N'大区','vi',N'Khu vực chính')
) t(ref_key, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                  WHERE x.scope='field' AND x.ref_key=t.ref_key AND x.locale=t.locale);
SET @trn = @@ROWCOUNT;
PRINT N'  ✓ 大区 译名补 ' + CAST(@trn AS nvarchar(10)) + N' 条';
GO

-- ══════════ 9. 验证 ══════════
SELECT N'bs_wh.厂区 列(应 40)' AS 检查项, CAST(COL_LENGTH('dbo.bs_wh', N'厂区') AS nvarchar(10)) AS 值
UNION ALL SELECT N'bs_wh_loc.厂区 已移除(应 NULL)', CAST(COL_LENGTH('dbo.bs_wh_loc', N'厂区') AS nvarchar(10))
UNION ALL SELECT N'WHLOC 仍登记厂区字段(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code='WHLOC' AND col_name=N'厂区'
UNION ALL SELECT N'bs_wh_loc.大区 列(应 60)', CAST(COL_LENGTH('dbo.bs_wh_loc', N'大区') AS nvarchar(10))
UNION ALL SELECT N'四个仓就位(应 4)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh
    WHERE (仓库编码=N'CK-A' AND 仓库名称=N'A仓' AND 厂区=N'老厂区')
       OR (仓库编码=N'CP-02' AND 仓库名称=N'B仓' AND 厂区=N'老厂区')
       OR (仓库编码=N'CK-C' AND 仓库名称=N'C仓' AND 厂区=N'老厂区')
       OR (仓库编码=N'CK-D' AND 仓库名称=N'D仓' AND 厂区=N'新厂区')
UNION ALL SELECT N'成品仓分类兜底(应 3)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh
    WHERE 仓库分类=N'成品' AND ISNULL(停用,0)=0 AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'CK-A2 已停用(应 1)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh WHERE 仓库编码=N'CK-A2' AND 停用=1
UNION ALL SELECT N'遗留 CK-A2 仓位(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A2' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'有效仓位总数(本脚本执行时应 679;后续批次会增)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'A仓 大区=原料区(应 156)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A' AND 大区=N'原料区' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'A仓 大区=辅料及配件区(应 103)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A' AND 大区=N'辅料及配件区' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'B仓 已去分区(应 180)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 仓库编码=N'CP-02' AND 大区 IS NULL AND 存储分区 IS NULL AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'C仓 已去分区(应 72)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-C' AND 大区 IS NULL AND 存储分区 IS NULL AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'D仓 成品仓位 大区=成品仓区(应 168;只数 D+数字 开头的成品编码)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-D' AND 仓位编码 LIKE N'D[0-9]%-%' AND 大区=N'成品仓区' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'仓位地址仍为空(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(仓位地址,N'')=N''
UNION ALL SELECT N'WHLOC 字段数(应 12)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code='WHLOC'
UNION ALL SELECT N'  大区 译名(应 9)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_translation WHERE scope='field' AND ref_key=N'大区'
UNION ALL SELECT N'WH 面板 厂区 字段(应 1)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code='WH' AND col_name=N'厂区'
UNION ALL SELECT N'区间层级.仓库 与 bs_wh 名称不一致(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc l
    JOIN dbo.bs_wh w ON w.仓库编码=l.仓库编码
    WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(l.仓库,N'')<>ISNULL(w.仓库名称,N'');
GO
PRINT N'=== 新层次全景(厂区/仓 取自 bs_wh;大区/分区 取自 bs_wh_loc) ===';
SELECT w.厂区, w.仓库名称 AS 仓, ISNULL(l.大区,N'(不分区)') AS 大区, ISNULL(l.存储分区,N'(—)') AS 分区, COUNT(*) AS 仓位数
FROM dbo.bs_wh_loc l JOIN dbo.bs_wh w ON w.仓库编码=l.仓库编码
WHERE ISNULL(l.asp_cancel,'N')<>'Y'
GROUP BY w.厂区, w.仓库名称, l.大区, l.存储分区 ORDER BY w.厂区 DESC, w.仓库名称, l.大区, l.存储分区;
GO
PRINT N'migrate-whloc-zone-logic-20261008 完成';
GO
