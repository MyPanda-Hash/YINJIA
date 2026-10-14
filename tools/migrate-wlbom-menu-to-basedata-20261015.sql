/* migrate-wlbom-menu-to-basedata-20261015.sql —— 把「物料清单」面板的入口挪到基础档案(用户 2026-10-15)
 *
 * 用户报障原文:「规格书的物料引用的物料清单的**1.关键物料列表**的物料清单面板入口**没有在基础档案里面**」
 *   —— 规格书里那份「关键物料列表」的数据源就是 WLBOM(物料清单)面板(数据落在单表 mate),
 *      但该面板在菜单里挂在「生产管理 → 单据」下,用户在基础档案里找不到入口去维护它。
 *
 * 取证(HSDZ_MES_TEST,两账套同源):
 *   WLBOM | 物料清单 | category=单据 | module_group=生产管理 | mode=doc | line_table=mate | head_table=(空)
 *   ⇒ 它是**单表 doc**型面板(与 CGD 采购单 / ROUTE 工艺路线 / WO_REPORT 工序报工单 同款),
 *     其中 **ROUTE 就挂在「基础设置」下** —— 所以"doc 型面板挂基础类目"是既有做法,不是特例。
 *   ⇒ **没有任何 yj_field 把 WLBOM 当参照源**(两条引用查询均为空),
 *     全库也没有按名字/表名引用 mate 的字段 ⇒ 改分类不波及规格书那条链。
 *
 * 处置:只改**菜单归属**两个字段,不动 mode/line_table/字段定义 ⇒ 面板行为一字不变:
 *   category      : 单据     → 基础档案   (与 ZDGL 数据字典 / GFDA 供应商 / KHDA 客户 同栏)
 *   module_group  : 生产管理 → 基础资料   (同上那几个档案面板的模块组)
 *
 * 幂等:重复执行 = 0 行(带 WHERE 只改还没挪过的)。两账套都跑(先 HSDZ_MES,后 HSDZ_MES_TEST)。
 * 用法:sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d <库> -C -f 65001 -i <本文件> -W -s"|"
 */
SET NOCOUNT ON;

/* ① 改前报数 */
SELECT N'[改前] WLBOM' AS 项,
       ISNULL(category, N'(空)') + N' / ' + ISNULL(module_group, N'(空)') + N' / mode=' + ISNULL(mode, N'(空)') AS 值
  FROM yj_panel WHERE panel_code = N'WLBOM';

/* ② 挪菜单归属(只改这两列;mode/line_table/字段定义一律不动) */
UPDATE yj_panel
   SET category = N'基础档案',
       module_group = N'基础资料'
 WHERE panel_code = N'WLBOM'
   AND (category <> N'基础档案' OR ISNULL(module_group, N'') <> N'基础资料');
PRINT N'[调整] WLBOM 菜单归属行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ③ 自证:改后 + 与同类档案面板并列 */
PRINT N'=== 改后:WLBOM 与它现在所在的这一栏 ===';
SELECT panel_code, panel_name, ISNULL(category, N'') AS 分类, ISNULL(module_group, N'') AS 模块组, mode
  FROM yj_panel
 WHERE (category = N'基础档案' AND module_group = N'基础资料')
 ORDER BY panel_code;

SELECT N'[自证] WLBOM 是否已在 基础档案/基础资料(应=1)' AS 项,
       CAST(COUNT(*) AS nvarchar(6)) AS 值
  FROM yj_panel WHERE panel_code = N'WLBOM' AND category = N'基础档案' AND module_group = N'基础资料'
UNION ALL
SELECT N'[自证] WLBOM 的关键属性未被动过(应=1: mode=doc 且 line_table=mate)',
       CAST(COUNT(*) AS nvarchar(6))
  FROM yj_panel WHERE panel_code = N'WLBOM' AND mode = N'doc' AND line_table = N'mate';
