/* =============================================================================
   migrate-mold-density-stdlib-20261111.sql
   -----------------------------------------------------------------------------
   用户口径(2026-11-11,研发管理优化 第 1 条):
     「把烧结工艺清单面板的密度管控的管控要求字段加入标准库,可以自行维护更新」

   现状(实测 yj_field,RD_MOLD_PROC):
     密度管控要求      data_type=文本  dict_sql=null  editable=1  seq=370  ⇒ 一个光秃秃的文本框,
                       界面上没有任何标准库入口,每张单都要手敲「密度范围：0.59~0.62」。
     密度管控          data_type=文本  editable=0 hidden=1  ⇒ 只是块名标签,不是数据格,本次不动。

   做法(与 asm.form / mold.sinter / mold.cooling 完全同一套机制,不新造概念):
     · yj_field.data_type = N'标准库'
     · yj_field.dict_sql  = 库编码 N'mold.density'
     · 条目落 yj_std_lib(lib_code='mold.density', item_code='默认', content=密度范围文本)
     · 前端 RecordSheetPanels 见 data_type='标准库' 就下发 options+stdLib:
         纸面上是**可下拉(选预设)/可手填(allow-create)**的一格,旁挂「⧉ 标准库维护」;
         维护(新增/编辑/停用/恢复启用/删除)走已有的 StdLibController:/api/stdlib/add|edit|remove。

   ⚠ 为什么**不动**「实际密度管控下限/上限」两格(用户明确口径):
     追问「实际密度管控范围 两个区域是不变动的 还是手动输入密度值供计算」时答复
     「就这样做」= ① 管控要求 挂标准库(可挑现成范围,也可手填);② 下限/上限**保持手工输入**。
     计算也确实只吃那两格 —— core/mold/recipeSheet.js 的 paramsFromHead():
       先读 实际密度管控下限 / 实际密度管控上限;两格都取不到才回落到解析 密度管控要求 文本。
     ⇒ 本次不碰这两格,也不改解析顺序;标准库只提供「管控要求」这一格的可选文本。

   ⚠ 内容格式与纸面占位符同形:
     占位符是「密度范围：~」(recordSheetConfigs RD_MOLD_PROC_SEC0),种子照抄成
     「密度范围：a~b」;parseDensityRange 认 `~ ～ - — 至`,所以老单据里已有的
     「0.58-0.60」之类文本照样解析得出来(历史值原样保留,不随库变动)。

   初始候选 3 条(可自行增删改;来源写进注释,不是凭空编的):
     · 密度范围：0.55~0.64  —— X烧结计算器默认密度参数上下限(calcEngine.js DEFAULTS densLow/densHigh)
     · 密度范围：0.58~0.60  —— 成型配方表判据用例的典型密度区间(recipeSheet.test.js headOK)
     · 密度范围：0.59~0.62  —— 现场单据实例(2026-11-11 截图:实际下限 0.59 / 上限 0.62)

   幂等:UPDATE 带窄条件(panel_code + col_name + place);种子按 (lib_code, content) 判重,
        重复执行只会新增 0 条。
   执行:两个账套都要跑(先 HSDZ_MES,后 HSDZ_MES_TEST)。
   ============================================================================= */
SET NOCOUNT ON;
GO

/* ---------- ① 密度管控要求 改为「标准库」类型 ---------- */
DECLARE @n int;
UPDATE yj_field
   SET data_type = N'标准库',
       dict_sql  = N'mold.density'
 WHERE panel_code = N'RD_MOLD_PROC'
   AND col_name   = N'密度管控要求'
   AND place      = N'header';
SET @n = @@ROWCOUNT;
PRINT N'[OK] RD_MOLD_PROC.密度管控要求 → 标准库(mold.density): ' + CAST(@n AS nvarchar(4)) + N' 行';
GO

/* ---------- ② 行数守卫:字段没改到就是前提不成立,直接中止 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_field
               WHERE panel_code = N'RD_MOLD_PROC'
                 AND col_name   = N'密度管控要求'
                 AND data_type  = N'标准库'
                 AND dict_sql   = N'mold.density')
BEGIN
    RAISERROR(N'[FAIL] RD_MOLD_PROC.密度管控要求 未能绑定标准库 mold.density', 16, 1);
END
GO

/* ---------- ③ 标准库种子(库编码 mold.density) ---------- */
DECLARE @lib nvarchar(50) = N'mold.density';
DECLARE @items TABLE (content nvarchar(200), seq int);
INSERT INTO @items (content, seq) VALUES
 (N'密度范围：0.55~0.64', 10),
 (N'密度范围：0.58~0.60', 20),
 (N'密度范围：0.59~0.62', 30);

INSERT INTO yj_std_lib (lib_code, item_code, content, enabled, seq, asp_user1, asp_time1)
SELECT @lib, N'默认', i.content, 1, i.seq, N'migration', SYSDATETIME()
FROM @items i
WHERE NOT EXISTS (SELECT 1 FROM yj_std_lib x
                  WHERE x.lib_code = @lib AND x.content = i.content
                    AND ISNULL(x.asp_cancel, N'N') <> N'Y');
PRINT N'[OK] mold.density 种子: ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 条新增';
GO

/* ---------- ④ 自证:库里有几条可用条目 ---------- */
SELECT lib_code, COUNT(*) AS 可用条目
FROM yj_std_lib
WHERE lib_code = N'mold.density' AND enabled = 1 AND ISNULL(asp_cancel, N'N') <> N'Y'
GROUP BY lib_code;
GO
