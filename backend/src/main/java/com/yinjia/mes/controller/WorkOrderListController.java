package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.WorkOrderPickingService;
import com.yinjia.mes.service.WorkOrderSplitService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工单排产·列表(2026-09-24,参考旧系统 ProSchedulingController 工单排产列表页):
 * ①/workOrderList 生产工单按**参考库 plang 表**展开(2026-09-24 用户拍板切源:外部系统直接写 plang,
 *   键=公司代码 comm + 工单号 pl_no + 工单行号 pl_xc;一单一行=一行,多行工单按 pl_xc 多行);
 *   条件:日期从/到(pl_date) + 单框模糊搜索(keyword,工单号/物料编码/产品名称/客户代码/客户名称 多列 OR);
 * ②/printStamp 打印生产任务单留痕(plang.asp_print+1、打印人/打印时间;修复原版从 scheduled('') 取数
 *   永远匹配不到已排产工单的缺陷——现直接打印列表勾选行,不再回查排产明细);
 * ③/close 结案/取消结案(plang.ja,参考库 T/Y 归一为 Y/N);
 * ④/toPicking 转领料单(2026-10-07:原「打印领料单」改为转单)——按工单号生成「材料出库单(领料单)」
 *   草稿,业务规则见 {@link WorkOrderPickingService}。
 * 定位(2026-09-26 用户拍板):生产工单=**纯查询+打印**,不作为快速排产任务——/reassign 批量调线已移除。
 * 权限:查看=登录即可(列表只读);写操作挂 MANU_ORDER(打印=打印按钮,结案/转领料单=保存词表)。
 */
@RestController
@RequestMapping("/api/px")
public class WorkOrderListController {

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;
    private final WorkOrderSplitService splitService;
    /** 转领料单(业务规则在 service,Controller 只做参数校验与转发 —— 代码规范 A2) */
    private final WorkOrderPickingService pickingService;

    public WorkOrderListController(JdbcTemplate jdbc, PanelPermissionService perm, WorkOrderSplitService splitService,
                                   WorkOrderPickingService pickingService) {
        this.jdbc = jdbc;
        this.perm = perm;
        this.splitService = splitService;
        this.pickingService = pickingService;
    }

    /** 工单行键:公司代码+工单号+工单行号+批次号(plang 行键;批次号=转单日期 yyyyMMdd,同日同批累加) */
    private record Key(String comm, String no, Integer xc, String batch) {
        static Key of(Map<String, Object> r) {
            String comm = str(r.get("公司代码"));
            String no = str(r.get("工单号"));
            Integer xc = null;
            Object x = r.get("工单行号");
            if (x instanceof Number n) xc = n.intValue();
            else if (x != null && !String.valueOf(x).isBlank()) {
                try { xc = Integer.valueOf(String.valueOf(x).trim()); } catch (NumberFormatException ignore) { }
            }
            String batch = str(r.get("批次号"));
            return new Key(comm == null ? "" : comm, no, xc, batch == null ? "" : batch);
        }

        boolean valid() { return no != null && !no.isBlank(); }

        String label() { return no + (xc == null ? "" : "#" + xc) + (batch == null || batch.isBlank() ? "" : "/" + batch); }
    }

    @PostMapping("/workOrderList")
    public ApiResult<List<Map<String, Object>>> list(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        List<Object> args = new ArrayList<>();
        StringBuilder w = new StringBuilder(" WHERE ISNULL(p.asp_cancel,'N') <> 'Y'");
        if (b.get("日期从") != null && !String.valueOf(b.get("日期从")).isBlank()) {
            w.append(" AND p.pl_date >= ?");
            args.add(String.valueOf(b.get("日期从")));
        }
        if (b.get("日期到") != null && !String.valueOf(b.get("日期到")).isBlank()) {
            // pl_date 是 datetime,「到」含当日全天(< 次日零点),对齐旧 date 型列的 <= 语义
            w.append(" AND p.pl_date < DATEADD(day, 1, ?)");
            args.add(String.valueOf(b.get("日期到")));
        }
        // 生产线筛选(2026-09-27 用户拍板:下拉此前无效——后端没接过滤条件)
        if (b.get("生产线") != null && !String.valueOf(b.get("生产线")).isBlank()) {
            w.append(" AND ISNULL(p.scx, N'') = ?");
            args.add(String.valueOf(b.get("生产线")).trim());
        }
        // 单框模糊搜索(2026-09-26 用户拍板):关键字在 工单号/物料编码/产品名称/客户代码/客户名称 多列 OR
        String kw = b.get("keyword") == null ? "" : String.valueOf(b.get("keyword")).trim();
        if (!kw.isEmpty()) {
            String like = "%" + kw + "%";
            w.append(" AND (p.pl_no LIKE ? OR p.dm LIKE ? OR p.mc LIKE ? OR p.khdm LIKE ? OR ISNULL(dk.mc,N'') LIKE ?)");
            for (int i = 0; i < 5; i++) args.add(like);
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.comm AS 公司代码, p.pl_no AS 工单号, p.pl_xc AS 工单行号,"
                        + " ISNULL(p.[批次号], N'') AS 批次号,"
                        + " p.pl_no AS 加工单号, p.id AS 行id, p.pl_xc AS 行号,"
                        + " CONVERT(varchar(10), p.pl_date, 120) AS 单据日期,"
                        + " CONVERT(varchar(16), p.asp_time1, 120) AS 转单时间,"
                        + " ISNULL(dk.mc, p.khdm) AS 客户, ISNULL(p.khdm, N'') AS 客户代码,"
                        + " ISNULL(p.scx, N'') AS 生产线,"
                        + " ISNULL(p.[打印人], N'') AS 打印人, CONVERT(varchar(16), p.[打印时间], 120) AS 打印时间,"
                        // 切单父子关联(9.29 批次①,2026-10-05):子单带 源工单号/拆分序号,列表直接可见「由谁切出」
                        + " ISNULL(p.[源工单号], N'') AS 源工单号, p.[拆分序号] AS 拆分序号,"
                        + " ISNULL(p.[源工单行id], 0) AS 源工单行id,"
                        // 血缘(会议口径第二版):根工单号(多级按根聚合)+ 是否切单(一眼区分原单/子单)
                        + " ISNULL(p.[根工单号], N'') AS 根工单号, ISNULL(p.[是否切单], N'N') AS 是否切单,"
                        + " CASE WHEN p.ja IN (N'T', N'Y') THEN N'Y' ELSE N'N' END AS 结案,"
                        + " p.dm AS 物料编码, ISNULL(p.mc, N'') AS 产品名称, ISNULL(p.gg, N'') AS 规格型号,"
                        + " ISNULL(p.jldw, N'') AS 生产单位,"
                        + " ISNULL(p.pl_sl, 0) AS 排产数量, ISNULL(p.xq_sl, 0) AS 需求数量, ISNULL(p.rk_sl, 0) AS 入库数量,"
                        + " ISNULL(管控.重点管控, N'否') AS 重点管控,"
                        // 当前工序/工序进度(9.29 批次① B 项,2026-10-05):工单贯穿制下 plang 无工序列,
                        // 「这单走到哪道工序」由报工派生(视图 v_wo_process_progress) —— 现场问的
                        // 「这是组装单还是成型单」= 当前工序指针,前端直接显示
                        // 「当前工序」= 该工单行**现在该做的工序**(2026-10-07 用户口径修正):
                        //   预排台账里最后一道「已落实」优先(在切炭线就该显示切炭),台账缺失时回落**本行**状态。
                        // 🔴 2026-10-15 修(用户口径「工单号+工单行号确定当前唯一工单,各个工单的进程、
                        //   流程追溯都这样实现,都需要这两个进行确定」):回落值原取视图 prg.当前工序 ——
                        //   那是**按单号聚合**的整单派生值 ⇒ 同工单所有行显示同一个工序(实测行2 路线是
                        //   GY-2026-10-0003 首道应为混料,却因视图显示成整单的成型)。
                        //   现改为回落 **p.当前工序**(本行自己的状态列,由 ProcessTaskService 按行维护)。
                        + " ISNULL(NULLIF((SELECT TOP 1 w.工序 FROM dbo.wo_process_line w"
                        + "   WHERE w.工单号 = p.pl_no AND ISNULL(w.asp_cancel,'N')<>'Y'"
                        + "     AND (w.工单行id = p.id OR w.工单行id IS NULL) AND ISNULL(w.状态,N'')=N'已落实'"
                        + "   ORDER BY ISNULL(w.工序序,999) DESC, w.id DESC), N''), ISNULL(p.[当前工序], N'')) AS 当前工序,"
                        // 当前工序完工量 = **该工单行**该道的已审报工量(2026-10-07:视图按单号聚合=整单口径,
                        //   与单行计划量配对会出现作用域错配「整单 56000 / 单行 75」⇒ 按行锚定)
                        + " ISNULL((SELECT SUM(ISNULL(s.sl,0)) FROM dbo.scjl s"
                        + "   WHERE s.gldh = p.pl_no AND s.gxdm = cop.当前工序"
                        + "     AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'"
                        + "     AND (EXISTS (SELECT 1 FROM dbo.plang_pc pcx WHERE pcx.id = s.gd_id AND pcx.plang_id = p.id)"
                        + "          OR (s.gd_id IS NULL AND ISNULL(s.[批次号],N'') = ISNULL(p.[批次号],N'')))), 0) AS 当前工序完工量,"
                        // 当前工序**计划量**(2026-10-07):= 本行排产数量 × 该工序自己的换算率(工序口径)。
                        //   前端原来显示「当前工序完工量 / 排产数量」是跨口径(成型 56000 / 成品 8000)⇒ 改与它配对
                        + " ISNULL((SELECT TOP 1 ISNULL(p.pl_sl,0) * ISNULL(r.换算率,1) FROM dbo.bs_route r"
                        + "   WHERE r.工艺路线编码 = ISNULL(p.[工艺路线],N'') AND r.工序名称 = cop.当前工序"
                        + "     AND ISNULL(r.asp_cancel,'N')<>'Y'), 0) AS 当前工序计划量,"
                        // 余量(2026-09-28 用户定稿)=订单结转的剩余数量:订单行需求 − 已转出占用
                        // (form_flow_link ACTIVE 占用,与订单结转页「剩余可转」同源;转工单/转采购都占)
                        + " ISNULL(p.xq_sl,0) - ISNULL((SELECT SUM(l.linked_quantity) FROM form_flow_link l"
                        + "   WHERE l.source_panel_code = 'SO_ORDER' AND l.source_form_no = p.od_no"
                        + "     AND l.source_line_key = p.od_no + N'#' + CONVERT(nvarchar(20), CONVERT(int, p.od_xc))"
                        + "     AND l.link_status = 'ACTIVE'), 0) AS 余量,"
                        + " ISNULL(p.ll_no2, N'') AS 领料单号, ISNULL(p.lot_no, N'') AS 批号,"
                        + " CONVERT(varchar(10), p.cp_date, 120) AS 计划完工日期,"
                        + " CAST(ISNULL(CAST(p.bz AS nvarchar(500)), N'') AS nvarchar(500)) AS 备注"
                        + " FROM dbo.plang p"
                        + " LEFT JOIN dbo.dm_kh dk ON dk.dm = p.khdm"
                        + " LEFT JOIN (SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS 重点管控"
                        + "            FROM bs_inv iv GROUP BY iv.存货编码) 管控 ON 管控.存货编码 = p.dm"
                        // ⚠ 2026-10-15 移除 `LEFT JOIN v_wo_process_progress prg ON prg.单号 = p.pl_no`:
                        //   该视图是**按单号聚合**的整单派生值(当前工序/进度/完工合计),与「工单号+工单行号
                        //   才是唯一工单」的口径冲突;且它是**一对多**风险源(视图按单号一行,join 尚安全,
                        //   但语义已是整单)。本查询已全部改用行级来源:当前工序取台账→本行 p.[当前工序]、
                        //   当前工序完工量按 p.id 锚定、当前工序计划量按本行路线换算 ⇒ 不再需要该视图。
                        // 当前工序 = 预排台账最后一道「已落实」(该行现在该做的工序),缺台账回落**本行** p.当前工序
                        + " CROSS APPLY (SELECT ISNULL(NULLIF((SELECT TOP 1 w.工序 FROM dbo.wo_process_line w"
                        + "   WHERE w.工单号 = p.pl_no AND ISNULL(w.asp_cancel,'N')<>'Y'"
                        + "     AND (w.工单行id = p.id OR w.工单行id IS NULL) AND ISNULL(w.状态,N'')=N'已落实'"
                        + "   ORDER BY ISNULL(w.工序序,999) DESC, w.id DESC), N''), ISNULL(p.[当前工序], N'')) AS 当前工序) cop"
                        + w + " ORDER BY p.pl_date DESC, p.pl_no, p.pl_xc",
                args.toArray());
        // 生产状态(与 v_manu_schedule 同口径:完工=入库≥排产;在产=有入库;其余未完工;未排产行=未排产)
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = new LinkedHashMap<>(r);
            double sched = ((Number) r.getOrDefault("排产数量", 0)).doubleValue();
            double in = ((Number) r.getOrDefault("入库数量", 0)).doubleValue();
            String line = String.valueOf(r.getOrDefault("生产线", ""));
            m.put("生产状态", line.isBlank() ? "未排产"
                    : sched > 0 && in >= sched ? "完工" : (in > 0 ? "在产" : "未完工"));
            out.add(m);
        }
        return ApiResult.ok(out);
    }

    /** 打印生产任务单留痕:plang.asp_print+1、打印人/打印时间(权限=MANU_ORDER 打印) */
    @PostMapping("/workOrderList/printStamp")
    public ApiResult<Map<String, Object>> printStamp(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "打印");
        List<Map<String, Object>> rows = castRows(body.get("rows"));
        if (rows.isEmpty()) throw new IllegalArgumentException("请先勾选要打印的工单");
        String user = currentUser();
        List<String> done = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Key k = Key.of(r);
            if (!k.valid()) continue;
            int n = jdbc.update("UPDATE dbo.plang SET asp_print = ISNULL(asp_print,0) + 1,"
                            + " [打印人]=?, [打印时间]=SYSDATETIME()"
                            + " WHERE comm=? AND pl_no=? AND pl_xc=?"
                            + " AND ((? = N'' AND [批次号] IS NULL) OR [批次号] = ?)"
                            + " AND ISNULL(asp_cancel,'N')<>'Y'",
                    user, k.comm(), k.no(), k.xc(), k.batch(), k.batch());
            if (n > 0) done.add(k.label());
        }
        if (done.isEmpty()) throw new IllegalStateException("无可打印的工单(plang 中未找到)");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("打印张数", done.size());
        out.put("单号清单", done);
        return ApiResult.ok(out);
    }

    /** 结案/取消结案:plang.ja=Y/N(参考库 T/Y 归一);留痕 yj_usage_log */
    @PostMapping("/workOrderList/close")
    public ApiResult<Map<String, Object>> close(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        boolean close = !"false".equals(String.valueOf(body.get("结案")));
        List<Map<String, Object>> rows = castRows(body.get("rows"));
        if (rows.isEmpty()) throw new IllegalArgumentException(close ? "请先勾选要结案的工单" : "请先勾选要取消结案的工单");
        String user = currentUser();
        List<String> done = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Key k = Key.of(r);
            if (!k.valid()) continue;
            try {
                if (close) {
                    // 结案口径(2026-10-05 用户口径「入库了才是结案,没入库只是完工」):
                    // 结案必须**入库完成**(入库量 ≥ 排产量);未入库点结案直接被拦并说明差额
                    Map<String, Object> q = jdbc.queryForMap("SELECT ISNULL(pl_sl,0) AS pl_sl, ISNULL(rk_sl,0) AS rk_sl"
                                    + " FROM dbo.plang WHERE comm=? AND pl_no=? AND pl_xc=?"
                                    + " AND ((? = N'' AND [批次号] IS NULL) OR [批次号] = ?)"
                                    + " AND ISNULL(asp_cancel,'N')<>'Y'",
                            k.comm(), k.no(), k.xc(), k.batch(), k.batch());
                    double plQty = ((Number) q.get("pl_sl")).doubleValue();
                    double rkQty = ((Number) q.get("rk_sl")).doubleValue();
                    if (rkQty + 0.0001 < plQty) {
                        throw new IllegalStateException("未入库完成,不能结案(入库 " + rkQty + " / 排产 " + plQty
                                + ";入库完成后系统自动/手工结案)");
                    }
                }
                int n = jdbc.update("UPDATE dbo.plang SET ja = ? WHERE comm=? AND pl_no=? AND pl_xc=?"
                                + " AND ((? = N'' AND [批次号] IS NULL) OR [批次号] = ?)"
                                + " AND ISNULL(asp_cancel,'N')<>'Y'",
                        close ? "Y" : "N", k.comm(), k.no(), k.xc(), k.batch(), k.batch());
                if (n == 0) throw new IllegalStateException("plang 中未找到");
                logUsage(user, close ? "结案" : "取消结案", k.no(), k.xc());
                done.add(k.label());
            } catch (IllegalStateException e) {
                failed.add(k.no() + ":" + e.getMessage());
            }
        }
        if (done.isEmpty()) throw new IllegalStateException("无行可操作:" + String.join("; ", failed));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put(close ? "结案张数" : "取消结案张数", done.size());
        out.put("单号清单", done);
        out.put("失败行", failed);
        return ApiResult.ok(out);
    }

    /** 批量调线端点已移除(2026-09-26 用户拍板:生产工单=纯查询+打印,不作为快速排产任务) */

    // ══════════ 工单切单(9.29 生产管理批次 ①,2026-10-05):切出子工单 / 撤回切单 ══════════
    // 入口=生产工单列表(生产线界面)勾选在产工单;口径与守卫见 WorkOrderSplitService。
    // 权限:查看+保存词表(与 结案/打印留痕 同级,不新增权限词条)。

    /** 切单预览:返回 可切上限 / 已入库 / 已完工报工 / 已切出,供弹窗限制输入范围 */
    @PostMapping("/workOrderList/splitPreview")
    public ApiResult<Map<String, Object>> splitPreview(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        return ApiResult.ok(splitService.preview(body == null ? Map.of() : body));
    }

    /** 切单:父单核减 + 子单新建(+ 继承排产)+ 占用链拆账 + 双向留痕 */
    @PostMapping("/workOrderList/split")
    public ApiResult<Map<String, Object>> split(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        return ApiResult.ok(splitService.split(body == null ? Map.of() : body, currentUser()));
    }

    /** 撤回切单:子单无下游(无报工/无入库/无领料/未结案/未再切分)才可撤回 */
    @PostMapping("/workOrderList/unsplit")
    public ApiResult<Map<String, Object>> unsplit(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        return ApiResult.ok(splitService.unsplit(body == null ? Map.of() : body, currentUser()));
    }

    // ══════════ 转领料单(2026-10-07:列表按钮由「打印领料单」改来)══════════
    // 勾选工单 → 生成「材料出库单(领料单)」草稿(加工单号=工单号,明细留空由仓库补);
    // 审核出库后 ManuWritebackService 自动回写工单「领料单号」。口径与守卫见 WorkOrderPickingService。

    /** 转领料单:按工单号去重逐张生成草稿;回执含 单号清单/失败行,前端据此提示并可跳材料出库单 */
    @PostMapping("/workOrderList/toPicking")
    public ApiResult<Map<String, Object>> toPicking(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        Map<String, Object> b = body == null ? Map.of() : body;
        return ApiResult.ok(pickingService.toPicking(castRows(b.get("rows")), currentUser()));
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> castRows(Object o) {
        if (o instanceof List<?> l) return (List<Map<String, Object>>) l;
        return List.of();
    }

    /**
     * 按钮留痕(yj_usage_log)。real_name 非空:从 yj_user 取,查不到回落登录名;
     * 留痕失败不阻断业务(口径同 ScheduleBoardService,但显式补齐 real_name 根因)。
     *
     * <p>2026-10-15:补 [工单行号] —— 用户口径「流转时间线…要根据工单行号完成」。
     * 行键落专列,**不再**往 doc_no 里拼(拼了会让 `doc_no=@工单号` 的查询匹配不上、留痕静默丢失)。
     */
    private void logUsage(String user, String action, String docNo, Integer xc) {
        try {
            jdbc.update("INSERT INTO yj_usage_log (user_name, real_name, event_type, panel_name, action_name, doc_no,"
                            + " [工单行号], created_at)"
                            + " VALUES (?, ISNULL((SELECT real_name FROM yj_user WHERE username = ?), ?),"
                            + " N'工单', N'生产工单', ?, ?, ?, GETDATE())",
                    user, user, user, action, docNo, xc);
        } catch (Exception ignore) { /* 留痕不阻断业务 */ }
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isBlank() ? null : s;
    }
}
