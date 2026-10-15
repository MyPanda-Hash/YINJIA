/* migrate-legacy-comments-fill-20261017.sql — 给 9 张遗留表「快照上也没注明」的 57 列补中文说明
 *
 * 【为什么】2026-10-17 逐列比对「本地正式库」与「服务器快照 HSDZ_MES_SRV1015」(= 服务器 HSDZ_MES
 *   2026-10-15 23:15 整库备份)后发现:dm_langue / gscs / permission / s_commdata / s_sys / s_xtcs /
 *   inh / outh / scjl 这 9 张表,**两边都还有 57 列完全没有 MS_Description**
 *   (列注明覆盖数与快照逐表相等,说明快照本身就缺,不是搬迁遗漏):
 *     dm_langue 10 / gscs 19 / permission 5 / s_commdata 1 / s_xtcs 1 / inh 8 / outh 12 / scjl 1 = 57
 *   本脚本把这 57 列按**原来的描述口径**补齐(见下「口径」),两账套均执行。
 *
 * 【口径 —— 严格按优先级取值,不臆造】
 *   ① 全库同名已有原文 → **照抄原文**(如 comm=公司 / xc=项次 / chs=简体 / cht=繁体 / eng=英文 /
 *      oth=其他 / bz=备注 / id=ID / USERID=用户ID);inh/outh 的中文列名(物料名称/规格型号/计量单位/
 *      仓库编码/经手人…)按「中文列名即语义」的既有做法直接落,已带原文的两列(单据编号/单据类型/
 *      单据日期/仓库名称)照抄本地既有原文。
 *   ② 拼音缩写可确解 → 给出中文义。gscs 的几个缩写有**取值佐证**(2026-10-17 抽样该表唯一一行):
 *      gsmc=公司名称、gsdh=公司电话(值 886-4-2706-0805)、tpwz=图片位置(值 D:\XBZX\)、
 *      xpsm1/xpsm2=小票说明1/2(值 NEW STEPS COMMERCIAL LIMITED / 银嘉环保);
 *      tm_* 一组按「tm=条码 / cd=长度 / gd=高度 / jj=间距 / bj=边距」释为条码打印几何参数。
 *   ③ 取值为空且拼音无确解的 6 列(gsgs / gszg / xpzs / msbdh / sczg / rem)——
 *      **如实标注「遗留列(经典 HSDZ 拼音缩写;语义待业务确认)」,不编造含义**。
 *
 * 【不覆盖】全部走 NOT EXISTS 守卫:已有注明的列一个字都不动。
 * 【幂等】重跑 = 0 行。两账套(先正式后测试)均执行。
 */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

DECLARE @c TABLE (tbl sysname, col sysname, note nvarchar(300));
INSERT INTO @c (tbl, col, note) VALUES
-- ── dm_langue(10)──
(N'dm_langue', N'comm',  N'公司'),
(N'dm_langue', N'id',    N'ID'),
(N'dm_langue', N'type',  N'类型'),
(N'dm_langue', N'xc',    N'项次'),
(N'dm_langue', N'lb_hi', N'高度'),
(N'dm_langue', N'chs',   N'简体'),
(N'dm_langue', N'cht',   N'繁体'),
(N'dm_langue', N'eng',   N'英文'),
(N'dm_langue', N'oth',   N'其他'),
(N'dm_langue', N'bz',    N'备注'),
-- ── gscs(19)──
(N'gscs', N'id',    N'ID'),
(N'gscs', N'gsmc',  N'公司名称'),
(N'gscs', N'gsdh',  N'公司电话'),
(N'gscs', N'tpwz',  N'图片位置(单行示例为目录路径)'),
(N'gscs', N'xpsm1', N'小票说明1'),
(N'gscs', N'xpsm2', N'小票说明2'),
(N'gscs', N'bz',    N'备注'),
(N'gscs', N'tm_cd',   N'条码长度(按拼音缩写:tm=条码,cd=长度)'),
(N'gscs', N'tm_gd',   N'条码高度(按拼音缩写:gd=高度)'),
(N'gscs', N'tm_zyjj', N'条码左右间距(按拼音缩写:jj=间距)'),
(N'gscs', N'tm_sxjj', N'条码上下间距(按拼音缩写:jj=间距)'),
(N'gscs', N'tm_sbj',  N'条码上边距(按拼音缩写:bj=边距)'),
(N'gscs', N'tm_zbj',  N'条码左边距(按拼音缩写:bj=边距)'),
(N'gscs', N'rem',     N'遗留列(经典 HSDZ 拼音缩写;语义待业务确认)'),
(N'gscs', N'gsgs',    N'遗留列(经典 HSDZ 拼音缩写;语义待业务确认)'),
(N'gscs', N'gszg',    N'遗留列(经典 HSDZ 拼音缩写;语义待业务确认)'),
(N'gscs', N'xpzs',    N'遗留列(经典 HSDZ 拼音缩写;语义待业务确认)'),
(N'gscs', N'msbdh',   N'遗留列(经典 HSDZ 拼音缩写;语义待业务确认)'),
(N'gscs', N'sczg',    N'遗留列(经典 HSDZ 拼音缩写;语义待业务确认)'),
-- ── permission(5)──
(N'permission', N'ID',        N'ID'),
(N'permission', N'USERID',    N'用户ID'),
(N'permission', N'MODULE1',   N'模块编码'),
(N'permission', N'RW',        N'权限位(读/写)'),
(N'permission', N'MODULE_NA', N'模块名称'),
-- ── s_commdata / s_xtcs / scjl(各 1)──
(N's_commdata', N'ID', N'ID'),
(N's_xtcs',     N'id', N'ID'),
(N'scjl',       N'id', N'ID'),
-- ── inh(8)──
(N'inh', N'id',       N'ID'),
(N'inh', N'物料名称', N'物料名称'),
(N'inh', N'规格型号', N'规格型号'),
(N'inh', N'计量单位', N'计量单位'),
(N'inh', N'仓库名称', N'仓库名称(金蝶 stock_name;销售订单行同步扩展列)'),
(N'inh', N'单价',     N'单价'),
(N'inh', N'往来单位', N'往来单位'),
(N'inh', N'经手人',   N'经手人'),
-- ── outh(12)──
(N'outh', N'id',       N'ID'),
(N'outh', N'单据编号', N'单号(面板字段列)'),
(N'outh', N'单据类型', N'单据类型(参考库 plang_pc.djlx;如 自制/委外/返工)'),
(N'outh', N'单据日期', N'单据日期(空白草稿自动填当天)'),
(N'outh', N'物料编码', N'物料编码'),
(N'outh', N'物料名称', N'物料名称'),
(N'outh', N'规格型号', N'规格型号'),
(N'outh', N'计量单位', N'计量单位'),
(N'outh', N'仓库编码', N'仓库编码'),
(N'outh', N'仓库名称', N'仓库名称(金蝶 stock_name;销售订单行同步扩展列)'),
(N'outh', N'往来单位', N'往来单位'),
(N'outh', N'经手人',   N'经手人');

DECLARE @tbl sysname, @col sysname, @note nvarchar(300), @added int = 0, @skip int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, note FROM @c ORDER BY tbl, col;
OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @col, @note;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @tbl, @col) IS NULL
        SET @skip = @skip + 1;                                  -- 列不存在(换环境):跳过
    ELSE IF EXISTS (SELECT 1 FROM sys.extended_properties ep
                     WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tbl) AND ep.name = N'MS_Description'
                       AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tbl), @col, 'ColumnId'))
        SET @skip = @skip + 1;                                  -- 已有注明:一个字都不动
    ELSE
    BEGIN
        EXEC sp_addextendedproperty N'MS_Description', @note, N'SCHEMA', N'dbo',
             N'TABLE', @tbl, N'COLUMN', @col;
        SET @added = @added + 1;
    END
    FETCH NEXT FROM cur INTO @tbl, @col, @note;
END
CLOSE cur; DEALLOCATE cur;
DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[OK] %s:补注明 %d 条,跳过(已有/列不存在) %d 条', 10, 1, @dbn, @added, @skip);
GO

/* ===== 自检:9 张表不得再有「无注明」的列 ===== */
DECLARE @dbn2 sysname = DB_NAME();
DECLARE @t2 TABLE (n sysname);
INSERT INTO @t2 (n) VALUES (N'dm_langue'), (N'gscs'), (N'permission'), (N's_commdata'),
                           (N's_sys'), (N's_xtcs'), (N'inh'), (N'outh'), (N'scjl');
DECLARE @miss TABLE (tbl sysname, col sysname);
INSERT INTO @miss (tbl, col)
SELECT t.name, c.name
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN @t2 f ON f.n = t.name
WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description');

SELECT tbl AS 表, COUNT(*) AS 缺注明列数 FROM @miss GROUP BY tbl ORDER BY tbl;

DECLARE @bad int = (SELECT COUNT(*) FROM @miss);
DECLARE @msg nvarchar(400) = ISNULL(STUFF((SELECT DISTINCT N' ' + tbl + N'.' + col FROM @miss
                                            FOR XML PATH(''), TYPE).value(N'.', N'nvarchar(400)'), 1, 1, N''), N'');
RAISERROR(N'[自检] %s:9 张遗留表无注明列数 = %d %s', 10, 1, @dbn2, @bad, @msg);
IF @bad = 0 RAISERROR(N'[OK] 9 张遗留表的列中文说明已补齐(57 列全部有注明)', 10, 1);
ELSE RAISERROR(N'[FAIL] 仍有未注明列(见上方清单)', 16, 1);
GO
