/* ============================================================================
   文书锁定字段:申请立项人 / 负责人 —— 由当前登录用户自动带入,用户不可改
   口径(2026-09-11 grill 确定):
     · RD_APPROVAL.申请立项人  ← 新增立项申请时的当前用户姓名
     · RD_PLAN.负责人          ← 新增实施计划时的当前用户姓名
       (RD_PLAN 没有「申请立项人」字段,该面板的人是「负责人」)
   实现分层:
     · 值:前端 core/panel/docDefaults.js 在「新增」这一刻写入——文书面板保存后
       管理员=已归档、普通用户=审批中,都不经过草稿态,所以不能挂在草稿 watch 上;
     · 锁:本迁移把 yj_field.editable 置 0 → PanelConfigService.buildMeta 下发
       readonly:true → 新增弹窗 / 单据签名格 / 列表内联编辑三处都只读。
   幂等:重复执行对已是 0 的字段无影响。
   ========================================================================== */
SET NOCOUNT ON;

UPDATE yj_field SET editable = 0
 WHERE (panel_code = N'RD_APPROVAL' AND col_name = N'申请立项人')
    OR (panel_code = N'RD_PLAN'     AND col_name = N'负责人');

SELECT N'锁定字段 editable=0(本次生效行数,重复执行为 0 属正常)' AS 项, @@ROWCOUNT AS 值;

SELECT panel_code, col_name, editable, required, hidden
  FROM yj_field
 WHERE (panel_code = N'RD_APPROVAL' AND col_name = N'申请立项人')
    OR (panel_code = N'RD_PLAN'     AND col_name = N'负责人')
 ORDER BY panel_code;
