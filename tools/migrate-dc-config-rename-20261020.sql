/* ═══════════════════════════════════════════════════════════════════════════════
   面板/页面名: '设备配置管理' → 'IOT设备配置'
   (2026-10-20 用户口径:「菜单名称改为 IOT设备配置 … 正式账套中也改为 IOT设备配置」)

   【对象】数采平台的设备配置页 DC_CONFIG —— 它是**页面级虚拟面板**
   (PagePanelRegistry 定义,无 yj_panel 行,数据走 api/dc 一组接口),所以库里只有
   yj_translation 的一条译名需要跟着改键;面板名本体在前端菜单与后端 PagePanelRegistry。

   【同批代码改动】
     · frontend menus.js(菜单标题) / router/index.js(路由 meta.title) /
       views/dc/DcConfig.vue(页面大标题 + 帮助文案) / DcMonitor.vue / DcStats.vue(引导文案)
     · frontend i18n en.js 词条键 + 文案(值改 IoT Device Configuration)
     · backend PagePanelRegistry(PagePanelDef 面板名) / DcController / DcPlatformService /
       DcService 的注释口径

   【幂等】只更新旧键行;重跑时旧键已 0 行 ⇒ 影响 0 行。
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
PRINT N'== 词条: 设备配置管理 → IOT设备配置 ==';

UPDATE yj_translation
   SET ref_key = N'IOT设备配置',
       text = CASE WHEN locale = 'en' THEN N'IoT Device Configuration' ELSE text END
 WHERE ref_key = N'设备配置管理';
PRINT N'  已改名 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* 键已经是新名但英文值仍是旧译的(分步改过的库):单独校一次,幂等 */
UPDATE yj_translation
   SET text = N'IoT Device Configuration'
 WHERE ref_key = N'IOT设备配置' AND locale = 'en' AND text <> N'IoT Device Configuration';
PRINT N'  英文值校正 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* ── 自检:旧键必须 0,新键必须存在 ── */
DECLARE @old int = (SELECT COUNT(1) FROM yj_translation WHERE ref_key = N'设备配置管理');
DECLARE @new int = (SELECT COUNT(1) FROM yj_translation WHERE ref_key = N'IOT设备配置');
IF @old <> 0
BEGIN
    DECLARE @m nvarchar(200) = N'[FAIL] 旧键残留 ' + CAST(@old AS nvarchar(10)) + N' 行';
    RAISERROR(@m, 16, 1);
    RETURN;
END
PRINT N'  [自检] 旧键 0 行,新键 ' + CAST(@new AS nvarchar(10)) + N' 行 ✓';
PRINT N'== 完成 ==';
