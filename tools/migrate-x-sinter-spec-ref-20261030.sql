/* ============================================================================
   migrate-x-sinter-spec-ref-20261030.sql
   X烧结工艺清单的「产品编号」改为**参照**产品信息表 —— 规格书联动的前置条件  2026-10-30

   【用户口径·原话】
     「这个新增的面板和之前的成型面板一样是可以关联规格书的数据的，
       就是通过产品编号进行关联，带入规格书的对应数据」

   【为什么要改这一行元数据】
     规格书联动的触发点是**选「产品编号」这个格**（autoFillSpec.fromKey）：
       选产品编号 → onProdRefConfirm() → GET /px/specByProductForXSinter?code=
       → 只带回已审核/已归档规格书的「检验要求」表区 → parse:'rodSize' 落三格
     而这个格只有在 yj_field 里声明成 `data_type='参照'`（ref_panel=RD_PROD_INFO）时，
     前端才会渲染成带弹窗的参照格、并在选中后触发带出链路。
     建面板时它写的是 `文本`（照抄设计稿，设计稿没画参照），所以带不出任何东西。

   【照抄 RD_MOLD_PROC 的同一行】
     老面板也是「纸面标签写 炭棒编号、数据键用 产品编号」：
       label=产品编号 / col_name=产品编号 / data_type=参照 /
       ref_panel=RD_PROD_INFO / ref_field=产品编号 / display_field=产品名称
     本脚本把 X烧结 那一行对齐成同样的配置（只改这 6 个属性，不动 label/seq/place）。

   ⚠ 两账套都要跑，已登记 tools/db-migrations.txt。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @db sysname = DB_NAME();

UPDATE yj_field
   SET data_type     = N'参照',
       ref_panel     = 'RD_PROD_INFO',
       ref_field     = N'产品编号',
       display_field = N'产品名称'
 WHERE panel_code = 'RD_X_SINTER'
   AND col_name   = N'产品编号';

/* 自检：必须是参照 + 指向 RD_PROD_INFO，否则前端不会走带出链路 */
DECLARE @dt  nvarchar(50) = (SELECT data_type FROM yj_field WHERE panel_code='RD_X_SINTER' AND col_name=N'产品编号');
DECLARE @rp  varchar(50)  = (SELECT ref_panel FROM yj_field WHERE panel_code='RD_X_SINTER' AND col_name=N'产品编号');

PRINT N'[DB] ' + @db;
PRINT N'[OK] RD_X_SINTER.产品编号 data_type=' + ISNULL(@dt, N'NULL') + N'，ref_panel=' + ISNULL(@rp, N'NULL');

IF @dt <> N'参照' OR @rp <> 'RD_PROD_INFO'
BEGIN
    ROLLBACK TRAN;
    RAISERROR(N'[FAIL] %s:产品编号未改成参照 RD_PROD_INFO,已回滚', 16, 1, @db);
    RETURN;
END

COMMIT TRAN;
PRINT N'[SELF-CHECK OK] X烧结产品编号已可参照产品信息表（规格书联动前置条件）';
