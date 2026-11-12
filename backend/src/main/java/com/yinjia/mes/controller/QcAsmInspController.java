package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.AsmInspEntry;
import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.PlangClose;
import com.yinjia.mes.service.PlangStatus;
import com.yinjia.mes.service.QcInspAutoService;
import com.yinjia.mes.service.WoInspGateGuard;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 出货检验表观({@code QC_ASM_INSP})按「生产工单 + 工单行号」创建(2026-11-12)。
 *
 * <p>用户口径:「同时增加当前出货表观可选生产工单,**实现方式和出货功能检验的选择工单一致**。」
 * ⇒ 与制程检验单({@link QcProcInspController})**同一套交互与前端弹窗**:
 * <ul>
 *   <li>{@code GET /api/qc/asmInsp/woLines} —— 列可选的生产工单行;</li>
 *   <li>{@code POST /api/qc/asmInsp/fromWoLine} —— 选中一行生成表观单草稿(幂等:已有存活单直接返回那张)。</li>
 * </ul>
 *
 * <p><b>准入判据与制程单不同</b>(制程单是「成型已报工」):表观单是「**已进入组装/装箱环节**」
 * (用户口径「在进入到组装/装箱这个工序或者产线的时候就生成」),判据/话术都在 {@link AsmInspEntry} 一处。
 * 未进入的行**照旧列出来并置灰**,写明原因;有「强制开单」权限的人可填原因越闸(留痕 {@code yj_usage_log}),
 * 与制程检验单的强制开单同一套执行层({@link WoInspGateGuard#enforceVerdict})。
 *
 * <p>为什么不是通用「选单」:同 {@link QcProcInspController} 类注释三条硬阻断(来源须已审核 /
 * 须带量明细行 / 头行映射只认来源表头),而本单要的字段全在工单**行**上。
 *
 * <p>权限:锚 {@code QC_ASM_INSP} 可见性(按钮只下发到这张单)。
 */
@RestController
@RequestMapping("/api/qc/asmInsp")
public class QcAsmInspController {

    private static final String PANEL = "QC_ASM_INSP";
    private static final String HEAD_TABLE = "qc_asm_insp_head";

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;
    private final PanelRegistry registry;
    private final ButtonService buttonService;
    private final QcInspAutoService qcInspAuto;
    private final WoInspGateGuard gate;

    public QcAsmInspController(JdbcTemplate jdbc, PanelPermissionService perm,
                               PanelRegistry registry, ButtonService buttonService,
                               QcInspAutoService qcInspAuto, WoInspGateGuard gate) {
        this.jdbc = jdbc;
        this.perm = perm;
        this.registry = registry;
        this.buttonService = buttonService;
        this.qcInspAuto = qcInspAuto;
        this.gate = gate;
    }

    /**
     * 可选的生产工单行:未作废、未结案({@link PlangClose})、工艺路线里含「组装/装箱」
     * ({@link AsmInspEntry#routeHasAssembly})。
     *
     * <p>不按「是否已进入」过滤 —— 未进入的行也列出来并置灰 + 写原因,现场能看到"差什么"
     * (与制程检验单选单弹窗同一口径:门禁不藏行)。
     */
    @GetMapping("/woLines")
    public ApiResult<Map<String, Object>> woLines(@RequestParam(required = false) String keyword,
                                                  @RequestParam(defaultValue = "1") int pageNo,
                                                  @RequestParam(defaultValue = "20") int pageSize) {
        perm.requirePanelView(PANEL);
        String kw = keyword == null ? "" : keyword.trim();
        int size = Math.max(1, Math.min(200, pageSize));
        int page = Math.max(1, pageNo);

        StringBuilder where = new StringBuilder(" WHERE ISNULL(p.asp_cancel,'N')<>'Y'"
                + " AND " + PlangClose.notClosed("p")
                + AsmInspEntry.routeHasAssembly("p"));
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
                        + " ISNULL(p.rk_sl,0) AS 入库数量, ISNULL(p.khdm,N'') AS 客户,"
                        + " ISNULL(p.[工艺路线],N'') AS 工艺路线, ISNULL(p.[完工状态],N'') AS 完工状态,"
                        + " " + PlangClose.closedFlag("p") + " AS 结案,"
                        // 该行已有的存活表观单(列表上直接标「已建单」,并供幂等提示)
                        + " ISNULL((SELECT TOP 1 h.[单据编号] FROM dbo." + HEAD_TABLE + " h"
                        + "          WHERE h.[工单号]=p.pl_no AND ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0)"
                        + "            AND ISNULL(h.asp_cancel,'N')<>'Y'), N'') AS 已建单号"
                        + " FROM dbo.plang p" + where
                        + " ORDER BY p.pl_no DESC, p.pl_xc"
                        + " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                pageArgs.toArray());

        decorate(rows);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", rows);
        out.put("totalSize", total == null ? 0 : total);
        out.put("gate", gate.meta(PANEL, true));   // 可强制开单(与制程检验单同一套执行层)
        return ApiResult.ok(out);
    }

    /**
     * 按生产工单行生成一张出货检验表观**草稿**。
     *
     * <p>表头/明细由 {@link QcInspAutoService#asmInspHeadForRow} 组装 —— 与**自动出单**同一份实现
     * (故手工建的与进入组装时自动出的长得一样)。
     *
     * <p>幂等:同一 (工单号, 工单行号) 已有存活表观单 ⇒ 直接返回那张,不重复建单。
     */
    @PostMapping("/fromWoLine")
    @Transactional
    public ApiResult<Map<String, Object>> fromWoLine(@RequestBody Map<String, Object> body,
                                                     HttpServletRequest request) {
        perm.requirePanelView(PANEL);
        String woNo = str(body.get("工单号"));
        Integer xc = intOf(body.get("工单行号"));
        if (woNo.isEmpty() || xc == null) return ApiResult.error(400, "请先选择生产工单行(工单号 + 工单行号)");

        // 定位工单行(按 id 定行:同一工单可能存在重复「行号」的旧数据;取最新一行)
        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT TOP 1 p.id AS 行id, p.pl_xc AS 工单行号"
                        + " FROM dbo.plang p"
                        + " WHERE p.pl_no=? AND ISNULL(p.pl_xc,0)=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + "   AND " + PlangClose.notClosed("p")
                        + " ORDER BY p.id DESC", woNo, xc);
        if (lines.isEmpty()) return ApiResult.error(400, "该生产工单行不存在、已作废或已结案：" + woNo + " #" + xc);
        long rowId = ((Number) lines.get(0).get("行id")).longValue();

        // 准入:已进入组装/装箱(前端虽已置灰,这里**再硬校验一次** —— 直连接口同样拦得住)
        AsmInspEntry.Status st = AsmInspEntry.of(jdbc, rowId);
        if (!st.entered()) {
            WoInspGateGuard.Decision d = gate.enforceVerdict(PANEL,
                    new WoInspGateGuard.Verdict(false, false, st.reason()),
                    woNo + "#" + xc, body, clientIp(request));
            if (!d.allowed()) return ApiResult.error(d.code(), d.error());
        }

        // 幂等:已有存活单直接返回
        List<String> exist = jdbc.queryForList(
                "SELECT TOP 1 [单据编号] FROM dbo." + HEAD_TABLE
                        + " WHERE [工单号]=? AND ISNULL([工单行号],0)=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " ORDER BY id DESC", String.class, woNo, xc);
        if (!exist.isEmpty()) return ApiResult.ok(created(exist.get(0), true));

        Map<String, Object> head = qcInspAuto.asmInspHeadForRow(rowId, xc);
        if (head == null) return ApiResult.error(422, AsmInspEntry.REASON_NOT_ENTERED);
        Map<String, Object> saved = buttonService.save(registry.panel(PANEL), head, false);
        return ApiResult.ok(created(str(saved.get("编号")), false));
    }

    /** 把「是否已进入组装/装箱」落到弹窗列表的每一行(键名与共享弹窗一致) */
    private void decorate(List<Map<String, Object>> rows) {
        Map<String, AsmInspEntry.Status> gateOf = AsmInspEntry.checkPage(jdbc, rows);
        for (Map<String, Object> r : rows) {
            AsmInspEntry.Status s = gateOf.get(
                    AsmInspEntry.key(str(r.get("工单号")), intOf(r.get("工单行号"))));
            r.put("进入环节", s == null || !s.entered() ? "" : s.op());
            r.put("进入量", s == null ? 0 : s.avail());
            r.put("已审报工量", s == null ? 0 : s.done());
            r.put("可开单", s == null || s.entered());
            r.put("预警放行", false);
            r.put("免门禁", false);
            r.put("存量放行", false);
            r.put("不能开单原因", s == null ? AsmInspEntry.REASON_NOT_ENTERED : s.reason());
            // 生产状态(与生产工单列表 / 首件检验单选单同一口径;缺的键按空处理)
            r.put("生产状态", PlangStatus.of(r));
        }
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

    /** 调用方 IP(门禁留痕用;与 PxController / QcProcInspController 同一写法) */
    private static String clientIp(HttpServletRequest request) {
        String fwd = request.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
