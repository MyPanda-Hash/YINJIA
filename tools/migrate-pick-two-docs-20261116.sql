/* ============================================================================
   migrate-pick-two-docs-20261116.sql
   ① 一个工单行现在要出**两张**领料单:组装领料 + 混料领料
      ⇒ wo_pick_doc 加「领料类型」,并把「一工单行一张单」的唯一约束放宽成
        (工单号, 工单行号, 领料类型)。
   ② 登记页面级虚拟面板 MOBILE_RETURN(生产退料)的授权与译名。

   用户口径(2026-11-16):
   「现在的生成工单领料需要生成两张领料单(一种就是现在的叫做组装领料,一种是混料领料
     (根据半成品的物料清单现在是空的))。并且明细要对这两个做区分。
     而且我还想生产退料独立出来,就是已经领料且审核的领料单据,来扫码退料。
     其实就是独立出来一个面版,让生产领料不用负责那么多功能,操作也方便。」

   口径确认(同日):
     · 混料领料**有明细才生成**(半成品清单为空 ⇒ 只出组装领料单,不产生空单);
     · 明细**只做单据级区分**(不加行级列,wo_pick_line 不动);
     · 生产退料从「生产领料」里移出,独立成面板。

   幂等:列存在则跳过;唯一索引按新定义重建。
   执行:两个账套都要跑(先 HSDZ_MES,后 HSDZ_MES_TEST)
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST，禁止在其他数据库执行。', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    /* ── ① 领料类型列 ───────────────────────────────────────────── */
    IF OBJECT_ID(N'dbo.wo_pick_doc', N'U') IS NULL
        THROW 51000, N'找不到 dbo.wo_pick_doc(请先执行 migrate-wo-pick-doc-20261030.sql)。', 1;

    IF COL_LENGTH(N'dbo.wo_pick_doc', N'领料类型') IS NULL
    BEGIN
        -- 存量单据全部是组装领料 ⇒ 默认值就是真相,不用回填脚本
        ALTER TABLE dbo.wo_pick_doc
            ADD 领料类型 nvarchar(20) NOT NULL
                CONSTRAINT DF_wo_pick_doc_lltype DEFAULT N'组装';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_pick_doc')
                     AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_pick_doc'), N'领料类型', 'ColumnId')
                     AND name = N'MS_Description')
        EXEC sys.sp_addextendedproperty N'MS_Description',
            N'领料类型:组装=按产品的《组装物料清单》展开;混料=按半成品(编码含 **TB)自己的物料清单展开。一个工单行最多各一张。',
            N'SCHEMA', N'dbo', N'TABLE', N'wo_pick_doc', N'COLUMN', N'领料类型';

    /* ── ② 唯一索引:(工单号,工单行号) → (工单号,工单行号,领料类型) ──────
       ⚠ 判断「几列」不要写成 `sys.indexes` 里套子查询再引 `object_id`/`index_id`
         —— 两个视图都有同名列,相关子查询会静默取错,脚本"看起来跑了"其实没重建
         (2026-11-16 实测:DbSync 报 OK、索引还是 2 列)。这里一律先删后建。 */
    IF EXISTS (SELECT 1 FROM sys.indexes i
               WHERE i.object_id = OBJECT_ID(N'dbo.wo_pick_doc') AND i.name = N'UX_wo_pick_doc_wo')
        DROP INDEX UX_wo_pick_doc_wo ON dbo.wo_pick_doc;

    CREATE UNIQUE INDEX UX_wo_pick_doc_wo
        ON dbo.wo_pick_doc (工单号, 工单行号, 领料类型);

    /* ── ③ 生产退料:页面级虚拟面板授权(与 PROD_PICK 同口径) ─────────────
       页面本身的定义在 PagePanelRegistry.MOBILE_RETURN;真正的数据闸门仍是
       MATERIAL_OUT / MATERIAL_RET 两个面板,这里只让它在「角色与面板权限」里可勾。 */
    INSERT INTO dbo.yj_role_panel (role_id, panel_code, perms, can_approve)
    SELECT r.id, N'MOBILE_RETURN', N'view,query,pick', 'N'
      FROM dbo.yj_role r
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x
                       WHERE x.role_id = r.id AND x.panel_code = N'MOBILE_RETURN');

    /* ── ④ 面板译名(多语言硬规范) ───────────────────────────────── */
    INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
    SELECT v.scope, v.ref_key, v.locale, v.text, 'manual'
      FROM (VALUES
            ('panel', N'生产退料', 'en', N'Production Return'),
            ('panel', N'生产退料', 'ja', N'生産材料返却'),
            ('panel', N'生产退料', 'ko', N'생산 자재 반납'),
            ('panel', N'生产退料', 'zh-TW', N'生產退料'),
            ('panel', N'生产退料', 'de', N'Produktionsrückgabe'),
            ('panel', N'生产退料', 'es', N'Devolución de producción'),
            ('panel', N'生产退料', 'fr', N'Retour de production'),
            ('panel', N'生产退料', 'ru', N'Возврат в производство'),
            ('panel', N'生产退料', 'th', N'การคืนวัสดุการผลิต'),
            ('panel', N'生产退料', 'vi', N'Trả vật tư sản xuất')
           ) v(scope, ref_key, locale, text)
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation t
                       WHERE t.scope = v.scope AND t.ref_key = v.ref_key AND t.locale = v.locale);

    /* ── ⑤ 收尾自检 ─────────────────────────────────────────────── */
    IF COL_LENGTH(N'dbo.wo_pick_doc', N'领料类型') IS NULL
        THROW 51000, N'领料类型 列没有加上。', 1;
    IF (SELECT COUNT(*) FROM sys.index_columns ic
         JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
         WHERE i.object_id = OBJECT_ID(N'dbo.wo_pick_doc') AND i.name = N'UX_wo_pick_doc_wo') <> 3
        THROW 51000, N'唯一索引 UX_wo_pick_doc_wo 不是 3 列(工单号,工单行号,领料类型)。', 1;
    IF EXISTS (SELECT 1 FROM dbo.yj_role r
                WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x
                                  WHERE x.role_id = r.id AND x.panel_code = N'MOBILE_RETURN'))
        THROW 51000, N'有角色没有 MOBILE_RETURN 授权。', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

/* ── ⑥ 结果自述 ─────────────────────────────────────────────────── */
SELECT N'wo_pick_doc.领料类型' AS 项,
       CASE WHEN COL_LENGTH(N'dbo.wo_pick_doc', N'领料类型') IS NULL THEN N'缺失' ELSE N'就位' END AS 结论
UNION ALL
SELECT N'唯一索引(工单号,工单行号,领料类型)',
       CAST((SELECT COUNT(*) FROM sys.index_columns ic
              WHERE ic.object_id = OBJECT_ID(N'dbo.wo_pick_doc')
                AND ic.index_id = (SELECT index_id FROM sys.indexes
                                    WHERE object_id = OBJECT_ID(N'dbo.wo_pick_doc') AND name = N'UX_wo_pick_doc_wo')) AS nvarchar(10)) + N' 列'
UNION ALL
SELECT N'MOBILE_RETURN 授权角色数',
       CAST((SELECT COUNT(*) FROM dbo.yj_role_panel WHERE panel_code = N'MOBILE_RETURN') AS nvarchar(10))
UNION ALL
SELECT N'生产退料 译名条数',
       CAST((SELECT COUNT(*) FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'生产退料') AS nvarchar(10));

SELECT N'RESULT: PICK-TWO-DOCS-READY' AS 结果;
