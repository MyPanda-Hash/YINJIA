/* _cleanup-demo-dev-tasks-20261013.sql —— 清掉 2026-09-21 的演示分发记录(rd_dev_task)
 *
 * 用户口径(2026-10-13):「如果是遗留的旧数据问题就直接删掉旧单据,不要旧数据影响操作」。
 *
 * 起因:新做的「待开发单据」入口(4 类下游面板侧栏)按 rd_dev_task 里
 *   「目标面板 + 负责人 = 当前登录人」列单,于是 cp 会看到两条**演示遗留**:
 *     DEMO-A-001(除重金属炭棒滤芯(演示)) / DEMO-B-001(碱性炭棒滤芯(演示))
 *   —— 它们 2026-09-21 15:33:58 由 glm53 分发,但**产品信息表里没有对应单据**
 *     (实测 rd_prod_info_head 匹配 0 张),所以弹窗里「单据编号」列是空的,只是噪音。
 *
 * 删除前取证(两账套一致):
 *   · rd_dev_task 里 DEMO 行 = 8 行(id 220-227),覆盖 RD_MOLD_PROC/RD_ASM_PROC/
 *     RD_SPEC_DOC/RD_INSP_PLAN 四个面板 × 两个演示产品;
 *   · 这 4 类面板下 **DEMO 相关单据 = 0 张**(规格书/出货检验计划表/成型工艺清单/
 *     组装工艺清单全为 0),产品信息表也 0 张 ⇒ 删这两行分发**不牵连任何业务单据**;
 *   · rd_spec_assign 为空,无对应分发映射。
 *   正式库 rd_dev_task 共 8 行(全是 DEMO,删完即空);测试库 12 行(8 DEMO + 4 张真实 CSCS 批次)。
 *
 * 幂等:重复执行 = 0 行。两账套都跑(先 HSDZ_MES,后 HSDZ_MES_TEST)。
 * 用法:sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d <库> -C -f 65001 -i <本文件> -W -s"|"
 * 备份:删前整表备份到 rd_dev_task_bak_20261013(与 mate 那次同款处置),确认不需要后由用户决定是否删除。
 */
SET NOCOUNT ON;
-- ⚠ 必须有这两行:rd_dev_task 被**索引视图**引用,对其 DELETE 要求连接级
--   QUOTED_IDENTIFIER ON + ANSI_NULLS ON(索引视图的创建/维护前提)。
--   sqlcmd 走 -i 文件时默认 QUOTED_IDENTIFIER OFF ⇒ 报文
--   「DELETE 失败,因为下列 SET 选项的设置不正确: 'QUOTED_IDENTIFIER'」(实测踩到)。
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

/* ① 备份整表(只备份一次) */
IF OBJECT_ID('rd_dev_task_bak_20261013') IS NULL
BEGIN
    SELECT * INTO rd_dev_task_bak_20261013 FROM rd_dev_task;
    PRINT N'[备份] rd_dev_task → rd_dev_task_bak_20261013 完成';
END
ELSE PRINT N'[备份] rd_dev_task_bak_20261013 已存在,跳过';

/* ② 删前报数(并再次确认这些产品确实没有关联单据) */
SELECT N'[删前] rd_dev_task DEMO 行' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM rd_dev_task WHERE 产品编号 LIKE N'DEMO%'
UNION ALL SELECT N'[删前] 关联产品信息表单据(应=0)', CAST(COUNT(*) AS nvarchar(10)) FROM rd_prod_info_head WHERE 产品编号 LIKE N'DEMO%'
UNION ALL SELECT N'[删前] 关联规格书(应=0)', CAST(COUNT(*) AS nvarchar(10)) FROM rd_spec_doc_head WHERE ISNULL(产品编号,N'') LIKE N'DEMO%'
UNION ALL SELECT N'[删前] 关联出货检验计划表(应=0)', CAST(COUNT(*) AS nvarchar(10)) FROM rd_insp_plan_head WHERE ISNULL(产品编号,N'') LIKE N'DEMO%'
UNION ALL SELECT N'[备份表] 行数', CAST(COUNT(*) AS nvarchar(10)) FROM rd_dev_task_bak_20261013;

/* ③ 执行 */
DELETE FROM rd_dev_task WHERE 产品编号 LIKE N'DEMO%';
PRINT N'[清理] 删除 DEMO 分发行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ④ 自证 */
SELECT N'[删后] DEMO 残留(应=0)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM rd_dev_task WHERE 产品编号 LIKE N'DEMO%'
UNION ALL SELECT N'[删后] rd_dev_task 剩余行数', CAST(COUNT(*) AS nvarchar(10)) FROM rd_dev_task;

PRINT N'=== 剩余分发记录 ===';
SELECT id, 产品编号, ISNULL(产品名称,N'') AS 产品名称, 目标面板, ISNULL(负责人,N'') AS 负责人
  FROM rd_dev_task ORDER BY id;
