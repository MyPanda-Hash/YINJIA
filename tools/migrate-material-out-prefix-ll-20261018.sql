/* migrate-material-out-prefix-ll-20261018.sql — 生产领料(材料出库单)单号前缀 CL → LL
 *
 * 用户口径(2026-10-18):「就改生产的就行,格式按照系统原来的,就改个前缀」。
 *   依据《单据编号.txt》「生产领料 LL(面料领用)」;系统里生产领料落「材料出库单」面板 MATERIAL_OUT。
 *   格式**不动**:仍是 FormNoService 方案 A 的 `前缀-yyyy-MM-NNNN`(2026-09-07 定稿)。
 *
 * 影响范围(刻意最小):
 *   · 只改 yj_panel.prefix 一个字段 ⇒ 只影响**以后 MES 新建/生单**的生产领料号;
 *   · 历史单号一个不改:423 张 `CL-2026-xx-xxxx`、487 张金蝶 `SCLL-yyyyMMdd-NNNNN` 原样保留;
 *   · 金蝶编码规则不动(`SCLL-` 由金蝶出号,MES 无权改);
 *   · 号池 s_allno 不清库:`CL` 的 460 条取号记录留作历史;新 `LL` 序列从 0001 起
 *     (号池里 5 条遗留紧凑号 `LL2610…` 的 ny=261017、形态不同,天然不串号);
 *   · 流程转换 / 生单链路 / 转ERP / 追溯全部按「单号字符串」传递,不解析前缀 ⇒ 无影响
 *     (已核:全库 20 个引用 单据编号 的视图/过程 0 个做 LEFT/SUBSTRING/LIKE 前缀解析;
 *      前端与后端也无前缀字面量。改完 PanelRegistry 30 秒 TTL 自动生效,无需重启)。
 *
 * 幂等:可重复执行(UPDATE 带旧值/目标值双条件);末尾自检不通过则 THROW 中断。
 * 撤回:UPDATE yj_panel SET prefix = N'CL' WHERE panel_code = N'MATERIAL_OUT';
 * 两账套均执行(先 HSDZ_MES,后 HSDZ_MES_TEST)。
 */
SET NOCOUNT ON;

/* ── 守卫 1:面板必须唯一存在 ─────────────────────────────────────────── */
IF (SELECT COUNT(*) FROM yj_panel WHERE panel_code = N'MATERIAL_OUT') <> 1
    THROW 50001, N'[守卫] 生产领料面板 MATERIAL_OUT 在 yj_panel 中不存在或不唯一,已停止。', 1;

/* ── 守卫 2:只允许从 CL(现役)或 LL(已改过)出发,防止误改别的取值 ── */
IF (SELECT COUNT(*) FROM yj_panel
    WHERE panel_code = N'MATERIAL_OUT' AND ISNULL(prefix, N'') IN (N'CL', N'LL')) <> 1
    THROW 50002, N'[守卫] MATERIAL_OUT 的当前前缀既不是 CL 也不是 LL,与预期不符,已停止(请人工确认)。', 1;

/* ── 守卫 3:本次目标前缀 LL 不得已被任何别的面板占用 ───────────────── */
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code <> N'MATERIAL_OUT' AND ISNULL(prefix, N'') = N'LL')
    THROW 50003, N'[守卫] 前缀 LL 已被其它面板占用,继续改会造成两个面板共用号池序列,已停止。', 1;

/* ── 改前缀(只动这一行) ───────────────────────────────────────────── */
UPDATE yj_panel
   SET prefix = N'LL'
 WHERE panel_code = N'MATERIAL_OUT'
   AND ISNULL(prefix, N'') <> N'LL';

DECLARE @changed int = @@ROWCOUNT;

/* ── 自检 1:目标值必须就位 ─────────────────────────────────────────── */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'MATERIAL_OUT' AND prefix = N'LL')
    THROW 50004, N'[自检] MATERIAL_OUT.prefix 未能改为 LL,已中断。', 1;

/* ── 自检 2:除本面板外,不得有任何面板的前缀被本脚本波及 ───────────── */
IF (SELECT COUNT(*) FROM yj_panel WHERE ISNULL(prefix, N'') = N'LL') <> 1
    THROW 50005, N'[自检] 前缀为 LL 的面板不止 MATERIAL_OUT 一个(或为零),异常,已中断。', 1;

/* ── 自检 3:历史单号只读校验(空库/新库不得因此中断整条迁移链) ───────────
   ⚠ 不能写成 THROW:DbInit 在**空库**上重放本脚本时 bd_material_out 是 0 行,
     硬 THROW 会把全量初始化打断(重建测试库 = 本脚本必跑)。
   口径:有 CL- 历史号 ⇒ 打出台数(证明本脚本没动它们);
        没有(空库/新库/已清理) ⇒ 只 PRINT 提示,不中断。 */
DECLARE @clHist int = 0;
IF OBJECT_ID(N'dbo.bd_material_out', N'U') IS NOT NULL
    SELECT @clHist = COUNT(*) FROM dbo.bd_material_out
     WHERE 单据编号 LIKE N'CL-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]';

IF OBJECT_ID(N'dbo.bd_material_out', N'U') IS NULL
    PRINT N'[提示] bd_material_out 不存在,跳过历史单号校验。';
ELSE IF @clHist = 0
    PRINT N'[提示] 本库没有 CL- 历史单号(空库/新库/已清理),跳过历史号保留校验。';
ELSE
    PRINT N'[自检] 历史 CL- 单号保留 ' + CAST(@clHist AS nvarchar(10)) + N' 张。';

PRINT N'migrate-material-out-prefix-ll-20261018 完成:'
    + N' MATERIAL_OUT.prefix = LL(本次改动行数 ' + CAST(@changed AS nvarchar(10)) + N');'
    + N' 历史 CL-/SCLL- 单号与金蝶侧均未改动;新单号形态 LL-yyyy-MM-NNNN。';
