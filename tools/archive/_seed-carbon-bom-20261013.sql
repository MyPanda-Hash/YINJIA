/* _seed-carbon-bom-20261013.sql —— 清掉 mate 表的光缆遗留数据,写入炭棒 BOM(5 行,父子关系)
 *
 * 用户口径(2026-10-13):「先清掉里面的旧数据,然后写入 5 条新数据,要有父子关系的数据」。
 *
 * 背景:mate 是 WLBOM(物料清单)面板的行表。原 35578 行是**光缆时代**的旧 BOM
 *   (光纤/芳纶纱/护套料,导入日期只有 2025-05-20~2025-06-03,母件名称列存的是代码本身,
 *   且全表 0 行含「炭」)—— 与炭棒滤芯业务零交集。故清空后按 bs_inv 的真实物料重建。
 *
 * 数据构造(全部取自 bs_inv 商品档案,不改编码/名称):
 *   父件 T382  除重金属炭棒滤芯(成品)
 *     ├─ M-001        炭棒
 *     ├─ M-003        炭纤维
 *     ├─ YJ-YPS-003   专用炭X3（80-250）
 *     └─ YJ-YKRS-012  专用炭X1（80-250）
 *   ⇒ 5 行明细 = 1 父 + 4 子。
 *
 * mate 表约束(实测):主键 (comm, id);id 为 identity 自增(不显式插入);
 *   comm / m_no / wzdm2 三列 NOT NULL,其余可空。
 *
 * ⚠ 旧数据先整表备份到 mate_bak_20261013(同库同结构),确认不需要后由用户决定是否删除。
 * ⚠ 两账套都要跑(先 HSDZ_MES,后 HSDZ_MES_TEST);幂等:重复执行 = 清空后重插同样 5 行。
 *
 * 用法:
 *   sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d HSDZ_MES      -C -f 65001 -i <本文件> -W -s"|"
 *   sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d HSDZ_MES_TEST -C -f 65001 -i <本文件> -W -s"|"
 */
SET NOCOUNT ON;

/* ① 备份旧数据(只备份一次) */
IF OBJECT_ID('mate_bak_20261013') IS NULL
BEGIN
    SELECT * INTO mate_bak_20261013 FROM mate;
    PRINT N'[备份] mate → mate_bak_20261013 完成';
END
ELSE
    PRINT N'[备份] mate_bak_20261013 已存在,跳过备份';

/* ② 清理前报数 */
SELECT N'[清理前] mate 行数' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM mate
UNION ALL SELECT N'[清理前] 含「炭」行数', CAST(COUNT(*) AS nvarchar(10)) FROM mate WHERE wzmc2 LIKE N'%炭%' OR wzmc1 LIKE N'%炭%'
UNION ALL SELECT N'[清理前] 备份表行数', CAST(COUNT(*) AS nvarchar(10)) FROM mate_bak_20261013;

/* ③ 清空 */
DELETE FROM mate;
PRINT N'[清理] mate 已清空';

/* ④ 写入 5 行(1 父 + 4 子) */
INSERT INTO mate (comm, m_no, m_date, wzdm1, wzmc1, xc, wzdm2, wzmc2, gg2, jldw2, bzl, sl2,
                  asp_user1, asp_time1, asp_cancel)
VALUES
 (N'0', N'T382', CAST(GETDATE() AS date), N'T382', N'除重金属炭棒滤芯', 10, N'M-001',        N'炭棒',              NULL, N'支', 1, 1, N'seed-20261013', GETDATE(), N'N'),
 (N'0', N'T382', CAST(GETDATE() AS date), N'T382', N'除重金属炭棒滤芯', 20, N'M-003',        N'炭纤维',            NULL, N'支', 1, 1, N'seed-20261013', GETDATE(), N'N'),
 (N'0', N'T382', CAST(GETDATE() AS date), N'T382', N'除重金属炭棒滤芯', 30, N'YJ-YPS-003',   N'专用炭X3（80-250）', NULL, N'支', 1, 1, N'seed-20261013', GETDATE(), N'N'),
 (N'0', N'T382', CAST(GETDATE() AS date), N'T382', N'除重金属炭棒滤芯', 40, N'YJ-YKRS-012',  N'专用炭X1（80-250）', NULL, N'支', 1, 1, N'seed-20261013', GETDATE(), N'N'),
 (N'0', N'T382', CAST(GETDATE() AS date), N'T382', N'除重金属炭棒滤芯', 50, N'HY-AC325+',    N'木制炭（+325）',     NULL, N'kg', 1, 1, N'seed-20261013', GETDATE(), N'N');
PRINT N'[写入] mate 新增行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ⑤ 写入后自证 */
SELECT N'[写入后] mate 行数(应=5)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM mate
UNION ALL SELECT N'[写入后] 母件数(应=1)', CAST(COUNT(DISTINCT wzdm1) AS nvarchar(10)) FROM mate
UNION ALL SELECT N'[写入后] 含「炭」行数(应≥4)', CAST(COUNT(*) AS nvarchar(10)) FROM mate WHERE wzmc2 LIKE N'%炭%'
UNION ALL SELECT N'[备份表] mate_bak_20261013 行数', CAST(COUNT(*) AS nvarchar(10)) FROM mate_bak_20261013;

PRINT N'=== mate 现有 5 行 ===';
SELECT id, m_no AS 母件号, wzdm1 AS 父件代码, wzmc1 AS 父件名称, xc AS 行序,
       wzdm2 AS 子件代码, wzmc2 AS 子件名称, jldw2 AS 单位
  FROM mate ORDER BY xc;
