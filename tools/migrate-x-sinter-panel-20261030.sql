/* ============================================================================
   migrate-x-sinter-panel-20261030.sql
   X烧结工艺清单（RD_X_SINTER）面板与字段元数据 —— 2026-10-30

   配套 migrate-x-sinter-tables-20261030.sql（建 rd_x_sinter_head / _detail）。

   【面板定位】
     产品文件里的「工艺文件」现在有两个入口：
       · 烧结工艺清单   = 既有 RD_MOLD_PROC（3 页：成型工艺清单/成型配方/修订记录），
                          本批只把**显示名**改成「烧结工艺清单」，panel_code 不动
       · X烧结工艺清单  = 本脚本新建 RD_X_SINTER（2 页：X烧结配方工艺管控清单 / 修订记录）
     用户口径：「两个入口在产品文件里面是属于同一份文件，只是模板不一样」，
     且「一个产品可能有两个工艺也可能就只有一个工艺」⇒ 两个面板各自独立建单，不互斥。

   【字段分组】按 Excel《X烧结工单模板-261029.xlsx》「产品工单打印输出模版」页的行序：
     信息栏 4 → 一、产品基本信息 9 → 二、成型管控要求（模具3+参数5）→
     计算输出 12 → 配料/特殊管控/备注
     计算输出列**全部 editable=1**：用户口径「所有文本框可手工二次输入修改」。

   ⚠ 译名一律走「表变量 + NOT EXISTS」逐条插入：yj_translation 有唯一键
     uq_translation(scope, ref_key, locale)，同词条（如「配料要求」）在别处已存在时
     直接 VALUES 会整批失败（2026-10-30 首次执行就撞过）。
   ⚠ 两账套都要跑，已登记 tools/db-migrations.txt。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @db sysname = DB_NAME();
DECLARE @PC varchar(50) = 'RD_X_SINTER';

/* ══════════════════ 1) yj_panel ══════════════════ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = @PC)
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table,
                          group_col, pk_col, code_col, prefix, date_col, page_size,
                          detail_key, module_group)
    VALUES (@PC, N'X烧结工艺清单', N'单据', 'doc', 'rd_x_sinter_detail', 'rd_x_sinter_head',
            N'单据编号', 'id', N'单据编号', 'XS', N'单据日期', 20,
            'items', N'研发管理');

/* ══════════════════ 2) yj_field · header（37 条）══════════════════ */
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                      editable, required, hidden, visible, dict_sql)
SELECT @PC, v.label, v.label, v.dtype, 'header', v.seq, 1, 0, 0, 1, v.dict
FROM (VALUES
    /* ── 信息栏 ── */
    (N'表单管理人',           N'文本',     10,  NULL),
    (N'密级',                 N'下拉框',   20,  N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)'),
    (N'使用范围',             N'下拉框',   30,  N'SELECT v FROM (VALUES (N''工艺科/成型车间''),(N''工程技术中心''),(N''银嘉内部''),(N''公司内'')) AS t(v)'),
    (N'版本号',               N'文本',     40,  NULL),
    /* ── 一、产品基本信息 ── */
    (N'产品编号',             N'文本',     50,  NULL),
    (N'炭棒编号',             N'文本',     60,  NULL),
    (N'产品名称',             N'文本',     70,  NULL),
    (N'炭棒外径',             N'文本',     80,  NULL),
    (N'炭棒内径',             N'文本',     90,  NULL),
    (N'炭棒出货长度',         N'文本',     100, NULL),
    (N'产品管控类型',         N'标准库',   110, N'prod.ctrl_level'),
    (N'产品形态',             N'标准库',   120, N'prod.form'),
    (N'生产车间',             N'下拉框',   130, N'SELECT v FROM (VALUES (N''1#''),(N''2#''),(N''3#''),(N''4#''),(N''5#''),(N''6#''),(N''7#'')) AS t(v)'),
    /* ── 模具与计算参数 ── */
    (N'模具出料口内径',       N'文本',     140, NULL),
    (N'中心杆外径',           N'文本',     150, NULL),
    (N'炭棒外径公差',         N'文本',     160, NULL),
    (N'炭棒内径公差',         N'文本',     170, NULL),
    (N'颗粒物料折算系数',     N'文本',     180, NULL),
    (N'成型修正长度参数mm',   N'文本',     190, NULL),
    (N'密度参数下限',         N'文本',     200, NULL),
    (N'密度参数上限',         N'文本',     210, NULL),
    /* ── 计算输出（五段）── */
    (N'切炭长度下限mm',       N'文本',     220, NULL),
    (N'切炭长度中间值mm',     N'文本',     230, NULL),
    (N'切炭长度上限mm',       N'文本',     240, NULL),
    (N'冷却长度下限mm',       N'文本',     250, NULL),
    (N'冷却长度中间值mm',     N'文本',     260, NULL),
    (N'冷却长度上限mm',       N'文本',     270, NULL),
    (N'炭棒重量下限g',        N'文本',     280, NULL),
    (N'炭棒重量中间值g',      N'文本',     290, NULL),
    (N'炭棒重量上限g',        N'文本',     300, NULL),
    (N'密度要求下限',         N'文本',     310, NULL),
    (N'密度要求中间值',       N'文本',     320, NULL),
    (N'密度要求上限',         N'文本',     330, NULL),
    /* ── 文本段 ── */
    (N'配料要求',             N'多行文本', 340, NULL),
    (N'特殊管控要求',         N'多行文本', 350, NULL),
    (N'备注',                 N'多行文本', 360, NULL),
    (N'变更来源单号',         N'文本',     370, NULL)
) AS v(label, dtype, seq, dict)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                   WHERE f.panel_code = @PC AND f.col_name = v.label AND f.place = 'header');

/* ══════════════════ 3) yj_field · detail（13 条）══════════════════ */
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                      editable, required, hidden, visible, dict_sql)
SELECT @PC, v.label, v.label, v.dtype, 'detail', v.seq, 1, 0, v.hid, 1, v.dict
FROM (VALUES
    (N'表区',       N'下拉框',   5,   1, N'SELECT v FROM (VALUES (N''配方表''),(N''修订记录'')) AS t(v)'),
    (N'序号',       N'文本',     10,  0, NULL),
    (N'物料种类',   N'下拉框',   20,  0, N'SELECT v FROM (VALUES (N''炭粉''),(N''胶粉''),(N''功能料-粉末''),(N''功能料-颗粒'')) AS t(v)'),
    (N'物料编号',   N'文本',     30,  0, NULL),
    (N'物料名称',   N'文本',     40,  0, NULL),
    (N'设计添加量', N'文本',     50,  0, NULL),
    (N'添加比例',   N'文本',     60,  0, NULL),
    (N'单支含量g',  N'文本',     70,  0, NULL),
    (N'更改内容',   N'文本',     80,  0, NULL),
    (N'更改原因',   N'文本',     90,  0, NULL),
    (N'更改时间',   N'文本',     100, 0, NULL),
    (N'责任人',     N'文本',     110, 0, NULL),
    (N'备注',       N'多行文本', 120, 0, NULL)
) AS v(label, dtype, seq, hid, dict)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                   WHERE f.panel_code = @PC AND f.col_name = v.label AND f.place = 'detail');

/* ══════════════════ 4) 译名：面板 + 缺 en 的字段（逐条幂等）══════════════════ */
DECLARE @tr TABLE (scope varchar(20), ref_key nvarchar(200), locale varchar(10), txt nvarchar(500));
INSERT INTO @tr (scope, ref_key, locale, txt) VALUES
    ('panel', N'X烧结工艺清单', 'en',    N'X-Sintering Process List'),
    ('panel', N'X烧结工艺清单', 'ja',    N'X焼結工程リスト'),
    ('panel', N'X烧结工艺清单', 'zh-TW', N'X燒結工藝清單'),
    ('panel', N'X烧结工艺清单', 'ko',    N'X소결 공정 목록'),
    ('panel', N'X烧结工艺清单', 'vi',    N'Danh sách quy trình thiêu kết X'),

    ('field', N'模具出料口内径',     'en',    N'Die outlet ID'),
    ('field', N'模具出料口内径',     'ja',    N'ダイ出 内径'),
    ('field', N'模具出料口内径',     'zh-TW', N'模具出料口內徑'),
    ('field', N'中心杆外径',         'en',    N'Center rod OD'),
    ('field', N'中心杆外径',         'ja',    N'センターロッド 外径'),
    ('field', N'中心杆外径',         'zh-TW', N'中心桿外徑'),
    ('field', N'颗粒物料折算系数',   'en',    N'Granular material conversion factor'),
    ('field', N'颗粒物料折算系数',   'ja',    N'粒子材料換算係数'),
    ('field', N'颗粒物料折算系数',   'zh-TW', N'顆粒物料折算係數'),
    ('field', N'成型修正长度参数mm', 'en',    N'Forming correction length (mm)'),
    ('field', N'成型修正长度参数mm', 'ja',    N'成形補正長さ (mm)'),
    ('field', N'成型修正长度参数mm', 'zh-TW', N'成型修正長度參數mm'),
    ('field', N'密度参数下限',       'en',    N'Density parameter min'),
    ('field', N'密度参数下限',       'ja',    N'密度パラメータ 下限'),
    ('field', N'密度参数下限',       'zh-TW', N'密度參數下限'),
    ('field', N'密度参数上限',       'en',    N'Density parameter max'),
    ('field', N'密度参数上限',       'ja',    N'密度パラメータ 上限'),
    ('field', N'密度参数上限',       'zh-TW', N'密度參數上限'),
    ('field', N'切炭长度下限mm',     'en',    N'Cut length min (mm)'),
    ('field', N'切炭长度下限mm',     'ja',    N'切断長さ 下限 (mm)'),
    ('field', N'切炭长度下限mm',     'zh-TW', N'切炭長度下限mm'),
    ('field', N'切炭长度中间值mm',   'en',    N'Cut length mid (mm)'),
    ('field', N'切炭长度中间值mm',   'ja',    N'切断長さ 中間値 (mm)'),
    ('field', N'切炭长度中间值mm',   'zh-TW', N'切炭長度中間值mm'),
    ('field', N'切炭长度上限mm',     'en',    N'Cut length max (mm)'),
    ('field', N'切炭长度上限mm',     'ja',    N'切断長さ 上限 (mm)'),
    ('field', N'切炭长度上限mm',     'zh-TW', N'切炭長度上限mm'),
    ('field', N'冷却长度下限mm',     'en',    N'Cooling length min (mm)'),
    ('field', N'冷却长度下限mm',     'ja',    N'冷却長さ 下限 (mm)'),
    ('field', N'冷却长度下限mm',     'zh-TW', N'冷卻長度下限mm'),
    ('field', N'冷却长度中间值mm',   'en',    N'Cooling length mid (mm)'),
    ('field', N'冷却长度中间值mm',   'ja',    N'冷却長さ 中間値 (mm)'),
    ('field', N'冷却长度中间值mm',   'zh-TW', N'冷卻長度中間值mm'),
    ('field', N'冷却长度上限mm',     'en',    N'Cooling length max (mm)'),
    ('field', N'冷却长度上限mm',     'ja',    N'冷却長さ 上限 (mm)'),
    ('field', N'冷却长度上限mm',     'zh-TW', N'冷卻長度上限mm'),
    ('field', N'炭棒重量下限g',      'en',    N'Rod weight min (g)'),
    ('field', N'炭棒重量下限g',      'ja',    N'炭棒重量 下限 (g)'),
    ('field', N'炭棒重量下限g',      'zh-TW', N'炭棒重量下限g'),
    ('field', N'炭棒重量中间值g',    'en',    N'Rod weight mid (g)'),
    ('field', N'炭棒重量中间值g',    'ja',    N'炭棒重量 中間値 (g)'),
    ('field', N'炭棒重量中间值g',    'zh-TW', N'炭棒重量中間值g'),
    ('field', N'炭棒重量上限g',      'en',    N'Rod weight max (g)'),
    ('field', N'炭棒重量上限g',      'ja',    N'炭棒重量 上限 (g)'),
    ('field', N'炭棒重量上限g',      'zh-TW', N'炭棒重量上限g'),
    ('field', N'密度要求下限',       'en',    N'Density requirement min'),
    ('field', N'密度要求下限',       'ja',    N'密度要求 下限'),
    ('field', N'密度要求下限',       'zh-TW', N'密度要求下限'),
    ('field', N'密度要求中间值',     'en',    N'Density requirement mid'),
    ('field', N'密度要求中间值',     'ja',    N'密度要求 中間値'),
    ('field', N'密度要求中间值',     'zh-TW', N'密度要求中間值'),
    ('field', N'密度要求上限',       'en',    N'Density requirement max'),
    ('field', N'密度要求上限',       'ja',    N'密度要求 上限'),
    ('field', N'密度要求上限',       'zh-TW', N'密度要求上限'),
    ('field', N'炭棒出货长度',       'en',    N'Rod shipping length'),
    ('field', N'炭棒出货长度',       'ja',    N'炭棒出荷長さ'),
    ('field', N'炭棒出货长度',       'zh-TW', N'炭棒出貨長度'),
    ('field', N'特殊管控要求',       'en',    N'Special control requirements'),
    ('field', N'特殊管控要求',       'ja',    N'特別管理要件'),
    ('field', N'特殊管控要求',       'zh-TW', N'特殊管控要求'),
    ('field', N'设计添加量',         'en',    N'Design addition'),
    ('field', N'设计添加量',         'ja',    N'設計添加量'),
    ('field', N'设计添加量',         'zh-TW', N'設計添加量'),
    ('field', N'添加比例',           'en',    N'Addition ratio'),
    ('field', N'添加比例',           'ja',    N'添加比率'),
    ('field', N'添加比例',           'zh-TW', N'添加比例'),
    ('field', N'单支含量g',          'en',    N'Content per piece (g)'),
    ('field', N'单支含量g',          'ja',    N'1本あたり含有量 (g)'),
    ('field', N'单支含量g',          'zh-TW', N'單支含量g');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT r.scope, r.ref_key, r.locale, r.txt, 'manual'
FROM @tr r
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                   WHERE t.scope = r.scope AND t.ref_key = r.ref_key AND t.locale = r.locale);

/* ══════════════════ 5) 角色授权（照抄 RD_MOLD_PROC：同族工艺文件，权限口径一致）══════════════════
   ⚠ 漏了这段的后果实测过：菜单能显示、面板能进路由，但一点进去就被前端路由守卫踢回登录页
     （canViewPanel 返回 false），表现为「新面板打不开」，而且没有任何报错提示。 */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.role_id, @PC, r.can_approve, r.perms
FROM yj_role_panel r
WHERE r.panel_code = 'RD_MOLD_PROC'
  AND NOT EXISTS (SELECT 1 FROM yj_role_panel x
                   WHERE x.role_id = r.role_id AND x.panel_code = @PC);

/* ══════════════════ 6) 自检 ══════════════════ */
DECLARE @hdr int = (SELECT COUNT(*) FROM yj_field WHERE panel_code=@PC AND place='header');
DECLARE @dtl int = (SELECT COUNT(*) FROM yj_field WHERE panel_code=@PC AND place='detail');
DECLARE @pnl int = (SELECT COUNT(*) FROM yj_panel WHERE panel_code=@PC);
DECLARE @trn int = (SELECT COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key=N'X烧结工艺清单');
DECLARE @rol int = (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code=@PC);
DECLARE @rol0 int = (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code='RD_MOLD_PROC');

PRINT N'[DB] ' + @db;
PRINT N'[OK] 面板 ' + CAST(@pnl AS nvarchar(5)) + N'/1,header 字段 ' + CAST(@hdr AS nvarchar(5))
    + N',detail 字段 ' + CAST(@dtl AS nvarchar(5)) + N',面板译名 ' + CAST(@trn AS nvarchar(5))
    + N'/5,角色授权 ' + CAST(@rol AS nvarchar(5)) + N'（对照 RD_MOLD_PROC ' + CAST(@rol0 AS nvarchar(5)) + N'）';

IF @pnl <> 1 OR @hdr < 37 OR @dtl < 13 OR @trn < 5 OR @rol < @rol0
BEGIN
    ROLLBACK TRAN;
    RAISERROR(N'[FAIL] %s:面板 %d/1、header %d/37、detail %d/13、译名 %d/5、授权 %d/%d,未齐备,已回滚',
              16, 1, @db, @pnl, @hdr, @dtl, @trn, @rol, @rol0);
    RETURN;
END

COMMIT TRAN;
PRINT N'[SELF-CHECK OK] X烧结工艺清单面板就绪';
