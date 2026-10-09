/* migrate-clean-orphan-sl-recv-field.sql(2026-10-05):清理孤立字段登记(体检 05 元数据漂移归零)
 *
 * 现象(数据库规范体检 05「字段绑定列不在对象表」1 处):`SL_RECV.计量单位(detail 位)` ——
 *   送料暂收单面板 2026-09-20 已改名 `QC_RECV`(物理表仍是 `sl_recv`),但 `yj_field` 里留下 1 行
 *   旧面板编码 `SL_RECV` 的字段登记;而 `yj_panel` 已无 `SL_RECV`,于是这行字段既取不到面板、
 *   其「计量单位」列也不在该面板对象表(旧绑定),体检按漂移报出。
 *
 * 处置:删除**面板已不存在**的孤立 `yj_field` 行(当前实测全库仅此 1 行,且编码限 SL_RECV)。
 *   不动 `QC_RECV` 的任何登记(它是现役面板)、不动 `sl_recv` 物理表、不动译名(面板名「送料暂收单」
 *   仍被 QC_RECV 使用)。删除前打印计数,删除后自检孤立行必须为 0。
 * 幂等可重跑;两账套均执行。
 */

DECLARE @n0 int = (SELECT COUNT(*) FROM yj_field f
                    WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code));
PRINT N'清理前:孤立字段登记行数 = ' + CAST(@n0 AS nvarchar(10));
/* 记下涉及哪些面板编码(排查用;面板不存在的登记 = 死元数据,取不到也用不上) */
SELECT DISTINCT f.panel_code AS 孤立面板编码, COUNT(*) AS 行数
  FROM yj_field f WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code)
 GROUP BY f.panel_code;

/* 通用清理:面板已不存在的字段登记一律删除(实测两台账套合计 4 行:SL_RECV 等改名/下架遗留)。
   不动任何现役面板的登记;删除前已打印计数与编码清单。 */
DELETE f FROM yj_field f
 WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code);
GO

/* 自检:全库不应再有「面板已不存在」的字段登记 */
IF EXISTS (SELECT 1 FROM yj_field f WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code))
BEGIN
  DECLARE @n int = (SELECT COUNT(*) FROM yj_field f WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code));
  DECLARE @msg nvarchar(200) = N'仍有孤立字段登记 ' + CAST(@n AS nvarchar(10)) + N' 行(需逐条查证后再清)';
  RAISERROR(@msg, 16, 1);
END
ELSE PRINT N'孤立字段登记已清零(体检 05 元数据漂移应归零)';
GO
