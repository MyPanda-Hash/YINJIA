package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.WorkOrderPickingService;
import com.yinjia.mes.service.WorkOrderRecipeService;
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
 * ④/toPicking 转领料单(2026-10-07:原「打印领料单」改为转单)——**先排产后领料**(2026-10-18):
 *   该工单行必须已排入产线(scx 非空)且排产数量 &gt; 0 才放行;按工单行生成「材料出库单(领料单)」草稿,
 *   同一工单行**可开多张**(再次点击 = 再开一张),业务规则见 {@link WorkOrderPickingService}。
 * 定位(2026-09-26 用户拍板):生产工单=**纯查询+打印**,不作为快速排产任务——/reassign 批量调线已移除。
 *
 * <p>权限(2026-10-16 补):本页此前是四页里**唯一连读都没拦**的 —— 菜单无 panelCode(任何登录账号可见)、
 * 列表接口零校验(登录即可读全部工单/客户/数量)。现挂**页面面板**
 * {@link PagePanelRegistry#WORK_ORDER_LIST}(可见/查询/打印/结案/切单/转领料单/导出/排产),
 * 写操作按各自动作词判定;与工单排产看板共用的端点(close/printStamp)按「任一命中」放行。
 */
@RestController
@RequestMapping("/api/px")
public class WorkOrderListController {

    /** 结案族与打印的两个入口:生产工单列表 + 工单排产看板(看板只有「取消结案」⇒ unclose 词) */
    private static final String[] CLOSE_ENTRIES = {
            PagePanelRegistry.WORK_ORDER_LIST, PagePanelRegistry.WORK_ORDER_BOARD};
    private static final String[] PRINT_ENTRIES = CLOSE_ENTRIES;

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;
    private final WorkOrderSplitService splitService;
    /** 转领料单(业务规则在 service,Controller 只做参数校验与转发 —— 代码规范 A2) */
    private final WorkOrderPickingService pickingService;
    /** 成型配方绑定与混料快照(按工单行) */
    private final WorkOrderRecipeService recipeService;
    /** 结案守卫:反查/回正「外部程序误写成已结案」的行(判据与 ProcessTaskService.syncCloseState 同源) */
    private final com.yinjia.mes.service.WorkOrderCloseGuard closeGuard;

    public WorkOrderListController(JdbcTemplate jdbc, PanelPermissionService perm, WorkOrderSplitService splitService,
                                   WorkOrderPickingService pickingService, WorkOrderRecipeService recipeService,
                                   com.yinjia.mes.service.WorkOrderCloseGuard closeGuard) {
        this.jdbc = jdbc;
        this.perm = perm;
        this.splitService = splitService;
        this.pickingService = pickingService;
        this.recipeService = recipeService;
        this.closeGuard = closeGuard;
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

    /**
     * 生产工单列表。
     *
     * <p>🔴 2026-10-18 加 {@code READ_UNCOMMITTED}(= 这条查询里的表都按 NOLOCK 读):
     * 手机端小程序/参考库是**直连同一个库**写 plang/scjl 的,那边事务没提交时行锁一直在;
     * 本查询是全表扫 + 每行相关子查询,**只要任意一行被锁就整页停住**(实测卡 42.7 秒,
     * 连接串加了 lockTimeout=8000 之后是 8 秒报错,但仍然是"点不开")。
     * 列表是**纯只读展示页**,读到别人未提交的中间值(最多一秒)远比"整页转圈"可接受;
     * 写操作(排产/结案/转领料)仍走默认隔离级别,不受影响。
     * ⚠ 这是隔离级别的**局部**设置(Spring 在事务结束后会把连接还原),
     * 不会影响小程序自己的连接,也不需要改库开关。
     */
    @PostMapping("/workOrderList")
    @org.springframework.transaction.annotation.Transactional(
            readOnly = true,
            isolation = org.springframework.transaction.annotation.Isolation.READ_UNCOMMITTED)
    public ApiResult<List<Map<String, Object>>> list(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.WORK_ORDER_LIST);
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
                        // 结案(2026-10-18 改判据):plang.ja 手机端/参考库也能直写 ⇒ 不再裸信 ja,
                        //   统一用 PlangClose:ja=Y **且** 入库≥排产(或参考库时代号段)。只读判定,不写任何数据。
                        + " " + com.yinjia.mes.service.PlangClose.closedFlag("p") + " AS 结案,"
                        // 结案异常(2026-10-18 加,2026-10-19 收口):
                        //   本页「已结案」只认 PlangClose;而 ja 是**外部程序也能直接写**的列
                        //   (手机端小程序/参考库直连同一个库)。MES 两条结案路径(页面「结案」按钮、
                        //   ProcessTaskService.syncCloseState)**都要求「入库 ≥ 排产(>0)」** ⇒
                        //   ja=Y 但入库没达标的行,一定不是 MES 结的,标「结案异常」让现场一眼看出。
                        //   ⚠ 旧判据额外要求"没有已审组装成品检验",与体检端点(WorkOrderCloseGuard)不等价:
                        //     实测正式库页面标红 19 行、体检 38 行,点「结案回正」会改掉页面没标红的 19 行。
                        //     现统一走 PlangClose.anomalyFlag(与"已结案"同源,见该类注释)。
                        + " " + com.yinjia.mes.service.PlangClose.anomalyFlag("p") + " AS 结案异常,"
                        // 完工状态(2026-10-15):生产状态的「完工」用它判,不再只看入库 ——
                        //   全部报工达标即 完工状态='生产完工' ⇒ 员工看到「完工」;结案另看 ja(需组装成品检验+入库)
                        + " ISNULL(p.[完工状态], N'') AS 完工状态,"
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
                        + "          OR (ISNULL(s.gd_id,0)=0 AND ISNULL(s.[批次号],N'') = ISNULL(p.[批次号],N'')))), 0) AS 当前工序完工量,"
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
                        + " ISNULL(p.[成型配方单号],N'') AS 成型配方单号, ISNULL(p.[成型配方版本],N'') AS 成型配方版本,"
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
        // 生产状态(2026-10-15 用户口径拆分「完工」与「结案」):
        //   · 已结案 = **plang.ja**(唯一结案标志;由「组装成品检验已审核 + 入库≥排产」重算,或手工结案);
        //   · 完工  = 完工状态 IN (生产完工, 已完工) —— 全部报工达标即成立,**不需要**(也不该等)入库/检验;
        //   · 在产  = 有入库但未达标;未完工 = 无入库;未排产 = 无产线。
        //   ⚠ 原口径「完工 = 入库≥排产」把"生产做完了"(完工)和"货入完库了"混在一个词里,
        //     用户报障「全部报工完成后不会变为完工,会变为已结案」即由此而来。
        //   2026-10-20:判定收口到 {@link com.yinjia.mes.service.PlangStatus} —— 首件检验单「选生产工单」
        //     显示同一列(用户报障:库里 完工状态 为 NULL 时那边兜底显示「未开工」,与本页「未排产」对不上)
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = new LinkedHashMap<>(r);
            m.put("生产状态", com.yinjia.mes.service.PlangStatus.of(m));
            out.add(m);
        }
        return ApiResult.ok(out);
    }

    /** 打印生产任务单留痕:plang.asp_print+1、打印人/打印时间(权限=MANU_ORDER 打印) */
    @PostMapping("/workOrderList/printStamp")
    public ApiResult<Map<String, Object>> printStamp(@RequestBody Map<String, Object> body) {
        perm.requirePanelViewAny(PRINT_ENTRIES);
        perm.requireButtonAny(PRINT_ENTRIES, "打印");
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
        perm.requirePanelViewAny(CLOSE_ENTRIES);
        boolean close = !"false".equals(String.valueOf(body.get("结案")));
        // 列表按「结案/取消结案」两词同挂 close;看板上的「取消结案」挂 unclose ⇒ 逐面板找词、任一命中
        perm.requireButtonAny(CLOSE_ENTRIES, close ? "结案" : "取消结案");
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
                // 2026-10-19:结案/取消结案**同时盖 asp_user2/asp_time2** ‑‑ 此前只写 yj_usage_log,
                //   导致"这行到底谁结的"在 plang 上看不出来(巡检/体检只能靠 yj_usage_log 反查)。
                //   不改任何判定,只是把留痕补全。
                int n = jdbc.update("UPDATE dbo.plang SET ja = ?, asp_user2 = ?, asp_time2 = GETDATE()"
                                + " WHERE comm=? AND pl_no=? AND pl_xc=?"
                                + " AND ((? = N'' AND [批次号] IS NULL) OR [批次号] = ?)"
                                + " AND ISNULL(asp_cancel,'N')<>'Y'",
                        close ? "Y" : "N", user, k.comm(), k.no(), k.xc(), k.batch(), k.batch());
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

    /**
     * **结案体检(只读)** —— 2026-10-18,用户报障「扫码报工后其余工单全部变成已结案」。
     *
     * <p>为什么需要它:生产工单页的「已结案」只认 {@code plang.ja},而这张表是
     * **手机端小程序/参考库直连写入**的 —— 也就是说 ja 可以被 MES 以外的程序改掉,
     * MES 既没有留痕也无从区分。查证时只能看到"全变已结案",没有任何线索指向是谁写的。
     *
     * <p>本端点按 MES 自己的结案口径反查异常行:
     * 「ja ∈ (T,Y) 但 (入库 &lt; 排产 或 没有已审核的组装成品检验单)」。
     * 这些行不可能是 MES 正常结出来的(见 {@code ProcessTaskService.syncCloseState}),
     * 只能是外部写入/历史遗留 ⇒ 列出来给现场核对,再由
     * {@code tools/migrate-plang-ja-foreign-close-repair-20261018.sql} 决定是否回正。
     *
     * <p>只读,不写任何数据;权限 = 生产工单页可见。
     */
    @PostMapping("/workOrderList/closeAudit")
    public ApiResult<List<Map<String, Object>>> closeAudit() {
        perm.requirePanelView(PagePanelRegistry.WORK_ORDER_LIST);
        return ApiResult.ok(closeGuard.findAnomalies(0));
    }

    /**
     * **结案回正**(手动,2026-10-18):把「外部程序误写成已结案」的行改回未结案。
     *
     * <p>与体检端点同一份判据({@link com.yinjia.mes.service.WorkOrderCloseGuard}),区别只是**真写库**:
     * {@code ja='N'} + {@code asp_user2=操作人} 留痕,并把每条回正写进后端日志
     * ({@code [结案自愈]} 前缀)。用于现场核对完清单后一键处理,不必再手工跑 SQL。
     *
     * <p>权限 = 生产工单页「结案」动作词(能结案的人才能回正)。参数 {@code {"rows":[{"工单号":..,"工单行号":..}]}}
     * 可只回正指定行;不传 = 回正全部异常行(单次上限 200)。
     */
    @PostMapping("/workOrderList/closeHeal")
    public ApiResult<Map<String, Object>> closeHeal(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.WORK_ORDER_LIST);
        perm.requireButtonAny(CLOSE_ENTRIES, "结案");
        String user = currentUser();
        List<String> healed = closeGuard.heal(user, 0);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("回正行数", healed.size());
        out.put("回正清单", healed);
        out.put("提示", healed.isEmpty() ? "没有需要回正的结案行" : "已回正为未结案（原 ja 由外部程序写入,已留痕 asp_user2）");
        return ApiResult.ok(out);
    }

    // ══════════ 工单切单(9.29 生产管理批次 ①,2026-10-05):切出子工单 / 撤回切单 ══════════
    // 入口=生产工单列表(生产线界面)勾选在产工单;口径与守卫见 WorkOrderSplitService。
    // 权限:查看+保存词表(与 结案/打印留痕 同级,不新增权限词条)。

    /** 切单预览:返回 可切上限 / 已入库 / 已完工报工 / 已切出,供弹窗限制输入范围 */
    @PostMapping("/workOrderList/splitPreview")
    public ApiResult<Map<String, Object>> splitPreview(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.WORK_ORDER_LIST);
        return ApiResult.ok(splitService.preview(body == null ? Map.of() : body));
    }

    /** 切单:父单核减 + 子单新建(+ 继承排产)+ 占用链拆账 + 双向留痕 */
    @PostMapping("/workOrderList/split")
    public ApiResult<Map<String, Object>> split(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.WORK_ORDER_LIST);
        perm.requireButton(PagePanelRegistry.WORK_ORDER_LIST, "切单");
        return ApiResult.ok(splitService.split(body == null ? Map.of() : body, currentUser()));
    }

    /** 撤回切单:子单无下游(无报工/无入库/无领料/未结案/未再切分)才可撤回 */
    @PostMapping("/workOrderList/unsplit")
    public ApiResult<Map<String, Object>> unsplit(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.WORK_ORDER_LIST);
        perm.requireButton(PagePanelRegistry.WORK_ORDER_LIST, "撤回切单");
        return ApiResult.ok(splitService.unsplit(body == null ? Map.of() : body, currentUser()));
    }

    // ══════════ 转领料单(2026-10-07:列表按钮由「打印领料单」改来)══════════
    // 勾选工单 → 生成「材料出库单(领料单)」草稿(加工单号=工单号,明细留空由仓库补);
    // 前置:**该行已排入产线且排产数量>0**(2026-10-18「先排产后领料」);
    // 一张工单行可开多张(每次点击新建一张,不再拦"已有未审核草稿")。
    // 审核出库后 ManuWritebackService 把该行全部领料单号回写工单「领料单号」。守卫见 WorkOrderPickingService。

    /** 转领料单:按「工单号+工单行号」逐行生成草稿(同一行可反复生成多张);回执含 单号清单/失败行 */
    @PostMapping("/workOrderList/toPicking")
    public ApiResult<Map<String, Object>> toPicking(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.WORK_ORDER_LIST);
        perm.requireButton(PagePanelRegistry.WORK_ORDER_LIST, "转领料单");
        Map<String, Object> b = body == null ? Map.of() : body;
        return ApiResult.ok(pickingService.toPicking(castRows(b.get("rows")), currentUser()));
    }

    /** 当前工单行读取已发布的成型配方。 */
    @PostMapping("/workOrderList/recipe")
    public ApiResult<Map<String, Object>> recipe(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.WORK_ORDER_LIST);
        return ApiResult.ok(recipeService.get(str(body.get("工单号")), longOf(body.get("行id")), doubleOf(body.get("混料数量"))));
    }

    /** 获取混料配方：保存工单行级配方快照、混料数量、配料比与计划用量。 */
    @PostMapping("/workOrderList/mixing")
    public ApiResult<Map<String, Object>> bindMixing(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.WORK_ORDER_LIST);
        perm.requireButton(PagePanelRegistry.WORK_ORDER_LIST, "获取混料配方");
        return ApiResult.ok(recipeService.bind(str(body.get("工单号")), longOf(body.get("行id")),
                doubleOf(body.get("混料数量")), currentUser()));
    }

    private static Long longOf(Object o) {
        if (o instanceof Number n) return n.longValue();
        if (o == null || String.valueOf(o).isBlank()) return null;
        try { return Long.valueOf(String.valueOf(o).trim()); } catch (NumberFormatException ignore) { return null; }
    }

    private static Double doubleOf(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        if (o == null || String.valueOf(o).isBlank()) return null;
        try { return Double.valueOf(String.valueOf(o).trim()); }
        catch (NumberFormatException e) { throw new IllegalArgumentException("混料数量必须为数字"); }
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
