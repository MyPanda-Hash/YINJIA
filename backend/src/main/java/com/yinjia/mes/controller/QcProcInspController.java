package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.WoInspGateGuard;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 制程检验单(QC_PROC_INSP)按「生产工单 + 工单行号」创建(2026-10-15 用户口径)。
 *
 * <p>用户口径:「当前的制程检验单的选单保留、完成对这个检验单的创建也可以 ——
 * 选择生产工单加工单行号唯一确定当前的生产工单」。</p>
 *
 * <p>为什么不是通用「选单」:实测三条各自独立的硬阻断 ——
 * <ol>
 *   <li>{@code VoucherFlowService.sources} 只放行**已审核**来源,而生产工单行(plang)从不进审核流;</li>
 *   <li>同处要求来源有**带数量的明细行**,而工单行是单层结构;</li>
 *   <li>{@code SelectVoucherDialog.selVal} 只读来源**表头**,取不到来源**行**上的值 ——
 *       而本单需要的 工单号/工单行号/产品编码 恰恰都在行上。</li>
 * </ol>
 * 故与既有三张工序检验单一样,走**专用入口**(参见 {@code ButtonService.woInspGenerate})。</p>
 *
 * <p>权限:锚 QC_PROC_INSP 可见性(按钮只下发到这张单;比"任一检验单可见"更紧,
 * 避免创建出调用者自己都打不开的单)。</p>
 */
@RestController
@RequestMapping("/api/qc/procInsp")
public class QcProcInspController {

    private static final String PANEL = "QC_PROC_INSP";
    private static final String HEAD_TABLE = "qc_proc_insp_head";

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;
    private final PanelRegistry registry;
    private final ButtonService buttonService;
    private final WoInspGateGuard gate;

    public QcProcInspController(JdbcTemplate jdbc, PanelPermissionService perm,
                               PanelRegistry registry, ButtonService buttonService,
                               WoInspGateGuard gate) {
        this.jdbc = jdbc;
        this.perm = perm;
        this.registry = registry;
        this.buttonService = buttonService;
        this.gate = gate;
    }

    /**
     * 可选的生产工单行:**已排产入线**、未作废、未结案(ja Y/T 皆属结案口径,见 ManuCloseHandler 注释);
     * 有预排台账的行还要求成型那道已排(见 {@link com.yinjia.mes.service.WoInspGate#pickable})。
     */
    @GetMapping("/woLines")
    public ApiResult<Map<String, Object>> woLines(@RequestParam(required = false) String keyword,
                                                  @RequestParam(defaultValue = "1") int pageNo,
                                                  @RequestParam(defaultValue = "20") int pageSize) {
        perm.requirePanelView(PANEL);
        String kw = keyword == null ? "" : keyword.trim();
        int size = Math.max(1, Math.min(200, pageSize));
        int page = Math.max(1, pageNo);

        // 只列「至少排产完成」的工单行(2026-10-18 用户口径;条件与首件检验单共用
        // WoInspGate.pickable —— 两个入口禁止各写一份)。
        StringBuilder where = new StringBuilder(" WHERE ISNULL(p.asp_cancel,'N')<>'Y'"
                + " AND " + com.yinjia.mes.service.PlangClose.notClosed("p") + ""
                + com.yinjia.mes.service.WoInspGate.pickable("p"));
        List<Object> args = new ArrayList<>();
        if (!kw.isEmpty()) {
            where.append(" AND (p.pl_no LIKE ? OR ISNULL(p.dm,'') LIKE ? OR ISNULL(p.mc,'') LIKE ?)");
            String like = "%" + kw + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }

        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM dbo.plang p" + where, Integer.class, args.toArray());

        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add((page - 1) * size);
        pageArgs.add(size);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id AS 行id, p.pl_no AS 工单号, p.pl_xc AS 工单行号,"
                        + " ISNULL(p.dm,N'') AS 产品编码, ISNULL(p.mc,N'') AS 产品名称,"
                        + " ISNULL(p.gg,N'') AS 规格型号, ISNULL(p.[批次号],N'') AS 批次号,"
                        + " ISNULL(p.scx,N'') AS 生产线, ISNULL(p.pl_sl,0) AS 排产数量,"
                        + " ISNULL(p.khdm,N'') AS 客户, ISNULL(p.[工艺路线],N'') AS 工艺路线,"
                        // 该行已有的存活制程检验单(列表上直接标「已建单」,并供幂等提示)
                        + " ISNULL((SELECT TOP 1 h.[单据编号] FROM dbo." + HEAD_TABLE + " h"
                        + "          WHERE h.[工单号]=p.pl_no AND h.[工单行号]=p.pl_xc"
                        + "            AND ISNULL(h.asp_cancel,'N')<>'Y'), N'') AS 已建单号"
                        + " FROM dbo.plang p" + where
                        + " ORDER BY p.pl_no DESC, p.pl_xc"
                        + " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                pageArgs.toArray());

        // 门禁(2026-10-19 用户口径「成型完成后的生产工单才能生成检验单」):判据/话术/留痕都在
        // WoInspGate + WoInspGateGuard 一处,与首件检验单、以及两个自动出单钩子共用同一份实现。
        // (2026-10-20:首件检验单已退出这道门禁,制程检验单不变。)
        gate.decorate(PANEL, rows);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", rows);
        out.put("totalSize", total == null ? 0 : total);
        out.put("gate", gate.meta(PANEL));      // 门禁档位 + 当前用户能否强制开单(弹窗顶部提示用)
        return ApiResult.ok(out);
    }

    /**
     * 按生产工单行生成一张制程检验单**草稿**(表头带工单行键,明细留空)。
     *
     * <p>明细恒空:沿用 2026-10-15 口径「检验单自动生成不需要实现明细行的自动填入」,
     * 检验项目由品质在单上点「取出货检验计划」按产品编码带入。</p>
     *
     * <p>幂等:同一 (工单号,工单行号) 已有存活制程检验单 ⇒ 直接返回那张,不重复建单。</p>
     */
    @PostMapping("/fromWoLine")
    @Transactional
    public ApiResult<Map<String, Object>> fromWoLine(@RequestBody Map<String, Object> body,
                                                    HttpServletRequest request) {
        perm.requirePanelView(PANEL);
        String woNo = str(body.get("工单号"));
        Integer xc = intOf(body.get("工单行号"));
        if (woNo.isEmpty() || xc == null) return ApiResult.error(400, "请先选择生产工单行(工单号 + 工单行号)");

        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT TOP 1 p.pl_no, p.pl_xc, ISNULL(p.dm,N'') AS dm, ISNULL(p.mc,N'') AS mc, ISNULL(p.gg,N'') AS gg,"
                        + " ISNULL(p.[批次号],N'') AS lot, ISNULL(p.scx,N'') AS scx"
                        + " FROM dbo.plang p"
                        + " WHERE p.pl_no=? AND p.pl_xc=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + "   AND " + com.yinjia.mes.service.PlangClose.notClosed("p"), woNo, xc);
        if (lines.isEmpty()) return ApiResult.error(400, "该生产工单行不存在、已作废或已结案：" + woNo + " #" + xc);
        Map<String, Object> line = lines.get(0);

        // 门禁(2026-10-19 用户口径「成型完成后的生产工单才能生成检验单」):
        //   前端虽已置灰,这里**再硬校验一次** —— 直连接口/绕过界面同样拦得住。
        //   强度档位(off/warn/block)、预警留痕、管理员强制开单都在 WoInspGateGuard 一处。
        WoInspGateGuard.Decision d = gate.enforce(PANEL, woNo, xc, body, clientIp(request));
        if (!d.allowed()) return ApiResult.error(d.code(), d.error());

        // 幂等:已有存活单直接返回
        List<String> exist = jdbc.queryForList(
                "SELECT TOP 1 [单据编号] FROM dbo." + HEAD_TABLE
                        + " WHERE [工单号]=? AND [工单行号]=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " ORDER BY id DESC", String.class, woNo, xc);
        if (!exist.isEmpty()) return ApiResult.ok(created(exist.get(0), true));

        String today = LocalDate.now().toString();
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", today);
        head.put("检验日期", today);
        head.put("工单号", woNo);
        head.put("工单行号", xc);
        head.put("产品编码", line.get("dm"));
        head.put("产品名称", line.get("mc"));
        head.put("规格型号", line.get("gg"));
        if (!str(line.get("lot")).isEmpty()) head.put("批次号", line.get("lot"));
        String prodLine = str(line.get("scx"));
        if (!prodLine.isEmpty()) {
            head.put("生产线", prodLine);
            // 车间是产线的属性(bs_prod_line.生产车间);反查不到就留空,不阻断建单
            List<String> shop = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL(生产车间,N'') FROM dbo.bs_prod_line WHERE 生产线=?", String.class, prodLine);
            if (!shop.isEmpty() && !shop.get(0).isBlank()) head.put("生产车间", shop.get(0));
        }
        head.put("检验类别", "制程检验");
        head.put("检验员", currentUser());
        head.put("detail", Map.of("items", List.of()));
        Map<String, Object> saved = buttonService.save(registry.panel(PANEL), head, false);
        return ApiResult.ok(created(str(saved.get("编号")), false));
    }

    /** 前端按既有 gotoPanel 通用分支自动跳转到该单 */
    private static Map<String, Object> created(String no, boolean existed) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", no);
        out.put("gotoPanel", PANEL);
        out.put("已存在", existed);
        return out;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static Integer intOf(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        String s = String.valueOf(o).trim();
        if (s.isEmpty()) return null;
        try {
            return (int) Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null || auth.getName() == null || auth.getName().isBlank() ? "system" : auth.getName();
    }

    /** 调用方 IP(门禁留痕用;与 PxController 同一写法) */
    private static String clientIp(HttpServletRequest request) {
        String fwd = request.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
