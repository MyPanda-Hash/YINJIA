package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.FirstInspItems;
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
 * 首件检验单(QC_FIRST_INSP)专用入口。
 *
 * <p><b>① 取成型工艺清单</b>(2026-10-15 用户口径「检验方式参考成型工艺清单内的检验要求进行编写」):
 * 自动出单(成型达计划量)时已经按《成型工艺清单》RD_MOLD_PROC 预铺过检验项目(见
 * {@code QcInspAutoService});本接口是**同一个来源的手动入口** —— 工艺清单当时还没维护、
 * 或者后来改了,品质在单上按产品编码重新带入一次即可。
 * 字段映射与 {@link FirstInspItems} 同一份实现(不复制粘贴);查不到不算错:返回 200 +
 * 按图纸恒铺的 10 列 + {@code moldProcNo=null},由前端给「该产品没有成型工艺清单」的话术。</p>
 *
 * <p><b>② 选生产工单</b>(2026-10-16 第三轮用户口径「让当前的首件检验单也可以选择到生产工单。
 * 当前制程检验单中存在实现方式,可以参照制程检验单的实现方式进行」):
 * 与 {@link QcProcInspController} **同一套做法**(列生产工单行 → 按「工单号+工单行号」建草稿 → 幂等),
 * 差别只有两处:建出来的单是首件检验单;明细**按《成型工艺清单》预铺**(与自动出单同源、同一个
 * {@link FirstInspItems}),而不是留空。通用「选单」不可用的三条硬阻断见 QcProcInspController 类注释。</p>
 *
 * <p><b>2026-10-20 口径变更(本单的准入条件)</b>:用户口径「当前是被流程卡死,不完成成型报工就不能产生
 * 当前的首件检验单……首件检验单需要关联当前的生产工单即可,不需要实现成型报工完成流程才产生。
 * 就是当前检验单能选取工单,**未完工的工单就可以选取**,但是**已经完成的就不需要能被选取**,
 * **已经被当前的检验单选取的也不能被再次选取**。」⇒
 * <ol>
 *   <li>**退出**「成型已报工」门禁({@link WoInspGate#gated}({@code QC_FIRST_INSP}) = false);</li>
 *   <li>列表只出**未完工**({@link PlangDone})、未结案、未作废的行 —— 已完工的行不再出现;</li>
 *   <li>已有存活首件检验单的工单行**不再列出**(不是灰掉,是根本不出现)。</li>
 * </ol>
 * 原来那道「成型完成才放行」的门禁对制程检验单、组装成品检验单仍然有效。</p>
 *
 * <p>权限:锚 QC_FIRST_INSP 可见性(按钮只下发到这张单)。</p>
 */
@RestController
@RequestMapping("/api/qc/firstInsp")
public class QcFirstInspController {

    private static final String PANEL = "QC_FIRST_INSP";
    private static final String HEAD_TABLE = "qc_first_insp_head";

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;
    private final PanelRegistry registry;
    private final ButtonService buttonService;
    private final WoInspGateGuard gate;

    public QcFirstInspController(JdbcTemplate jdbc, PanelPermissionService perm,
                                 PanelRegistry registry, ButtonService buttonService,
                                 WoInspGateGuard gate) {
        this.jdbc = jdbc;
        this.perm = perm;
        this.registry = registry;
        this.buttonService = buttonService;
        this.gate = gate;
    }

    /** GET /api/qc/firstInsp/fromMoldProc?productCode=xxx */
    @GetMapping("/fromMoldProc")
    public ApiResult<Map<String, Object>> fromMoldProc(@RequestParam String productCode) {
        perm.requirePanelView(PANEL);
        String code = productCode == null ? "" : productCode.trim();
        if (code.isEmpty()) return ApiResult.error(400, "请先填写产品编码");

        FirstInspItems.Result r = FirstInspItems.load(jdbc, code);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("productCode", code);
        out.put("moldProcNo", r.docNo());
        out.put("columns", r.columns());
        out.put("rows", r.rows());
        return ApiResult.ok(out);
    }

    /**
     * 可选的生产工单行(2026-10-20 用户口径,规则见类注释):
     * <ol>
     *   <li>未作废、**未结案**({@link com.yinjia.mes.service.PlangClose})、**未完工**
     *       ({@link com.yinjia.mes.service.PlangDone});</li>
     *   <li>该「工单号 + 工单行号」**还没有存活的首件检验单** —— 已被选过的不再出现。</li>
     * </ol>
     * 刻意**不要求**「已排产入线 / 成型已排」,也不再判「成型已报工」:首件检验是脱模后马上做的,
     * 那一刻成型报工往往还没录(这正是 2026-10-19 那道门禁把现场卡死的原因,见 {@link WoInspGate#gated})。
     */
    @GetMapping("/woLines")
    public ApiResult<Map<String, Object>> woLines(@RequestParam(required = false) String keyword,
                                                  @RequestParam(defaultValue = "1") int pageNo,
                                                  @RequestParam(defaultValue = "20") int pageSize) {
        perm.requirePanelView(PANEL);
        String kw = keyword == null ? "" : keyword.trim();
        int size = Math.max(1, Math.min(200, pageSize));
        int page = Math.max(1, pageNo);

        // 准入(2026-10-20):未作废 + 未结案 + 未完工 + 本行还没有存活的首件检验单。
        // 判据复用 PlangClose / PlangDone 两个唯一口径类,不在这里另写一份表达式。
        StringBuilder where = new StringBuilder(" WHERE ISNULL(p.asp_cancel,'N')<>'Y'"
                + " AND " + com.yinjia.mes.service.PlangClose.notClosed("p")
                + " AND " + com.yinjia.mes.service.PlangDone.notDone("p")
                + " AND NOT EXISTS (SELECT 1 FROM dbo." + HEAD_TABLE + " h"
                + "                 WHERE h.[工单号]=p.pl_no AND h.[工单行号]=p.pl_xc"
                + "                   AND ISNULL(h.asp_cancel,'N')<>'Y')");
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
                        + " ISNULL(p.khdm,N'') AS 客户,"
                        // 未完工的判据列(列表上给现场看「未开工 / 在制 / 空」)
                        + " ISNULL(p.[完工状态],N'') AS 完工状态,"
                        // 工艺路线:本单已不做门禁,但 {@link WoInspGate#checkPage} 判「路线里有没有成型这道」
                        // 要用它 —— 留着,`UNGATED_PANELS` 一旦去掉 QC_FIRST_INSP,门禁能原样复算(回滚只改一行)
                        + " ISNULL(p.[工艺路线],N'') AS 工艺路线"
                        + " FROM dbo.plang p" + where
                        + " ORDER BY p.pl_no DESC, p.pl_xc"
                        + " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                pageArgs.toArray());

        // 门禁(2026-10-20):首件检验单已退出成型报工门禁 ⇒ 这里只负责把「可开单=true」等共享键补齐,
        // 不再逐行判成型报工(开关在 WoInspGate.UNGATED_PANELS 一处,与制程检验单共用同一份实现)。
        gate.decorate(PANEL, rows);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", rows);
        out.put("totalSize", total == null ? 0 : total);
        out.put("gate", gate.meta(PANEL));      // 门禁生效=false + 能否强制开单(共享弹窗顶部提示用)
        return ApiResult.ok(out);
    }

    /**
     * 按生产工单行生成一张首件检验单**草稿**:表头带 工单号/工单行号/产品/批次/产线/客户,
     * 明细按《成型工艺清单》(RD_MOLD_PROC)预铺 —— 与自动出单(QcInspAutoService)同一份实现,
     * 故手工建的单与自动出的单长得一样。
     *
     * <p><b>生产日期刻意留空</b>:按 2026-10-16 第二轮口径,它由「工单第一批完工」时回填
     * (见 {@code FirstInspBackfill}),出单时不写死今天。</p>
     *
     * <p><b>准入(2026-10-20)</b>:未作废 + 未结案 + **未完工**才能建;已完工的行直接拒(与列表同口径)。
     * 不再要求「成型已报工」。</p>
     *
     * <p>幂等:同一 (工单号, 工单行号) 已有存活首件检验单 ⇒ 直接返回那张,不重复建单
     * (列表已把这种行滤掉,这里只兜直连接口)。</p>
     */
    @PostMapping("/fromWoLine")
    @Transactional
    public ApiResult<Map<String, Object>> fromWoLine(@RequestBody Map<String, Object> body,
                                                     jakarta.servlet.http.HttpServletRequest request) {
        perm.requirePanelView(PANEL);
        String woNo = str(body.get("工单号"));
        Integer xc = intOf(body.get("工单行号"));
        if (woNo.isEmpty() || xc == null) return ApiResult.error(400, "请先选择生产工单行(工单号 + 工单行号)");

        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT TOP 1 p.pl_no, p.pl_xc, ISNULL(p.dm,N'') AS dm, ISNULL(p.mc,N'') AS mc,"
                        + " ISNULL(p.gg,N'') AS gg, ISNULL(p.[批次号],N'') AS lot, ISNULL(p.scx,N'') AS scx,"
                        + " ISNULL(p.khdm,N'') AS khdm, ISNULL(dk.mc,N'') AS khmc"
                        + " FROM dbo.plang p LEFT JOIN dbo.dm_kh dk ON dk.dm = p.khdm"
                        + " WHERE p.pl_no=? AND p.pl_xc=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + "   AND " + com.yinjia.mes.service.PlangClose.notClosed("p")
                        + "   AND " + com.yinjia.mes.service.PlangDone.notDone("p"), woNo, xc);
        if (lines.isEmpty()) {
            return ApiResult.error(400, "该生产工单行不存在、已作废、已完工或已结案：" + woNo + " #" + xc);
        }
        Map<String, Object> line = lines.get(0);

        // 门禁(2026-10-20 用户口径):首件检验单**退出**成型报工门禁 —— 这一步现在恒放行,
        //   保留调用是为了让开关只存在 WoInspGate.UNGATED_PANELS 一处(将来收紧只改那一行);
        //   制程检验单同一处的 gate.enforce 仍然是硬校验。
        WoInspGateGuard.Decision d = gate.enforce(PANEL, woNo, xc, body, clientIp(request));
        if (!d.allowed()) return ApiResult.error(d.code(), d.error());

        // 幂等:已有存活单直接返回
        List<String> exist = jdbc.queryForList(
                "SELECT TOP 1 [单据编号] FROM dbo." + HEAD_TABLE
                        + " WHERE [工单号]=? AND [工单行号]=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " ORDER BY id DESC", String.class, woNo, xc);
        if (!exist.isEmpty()) return ApiResult.ok(created(exist.get(0), true));

        String today = LocalDate.now().toString();
        String productCode = str(line.get("dm"));
        FirstInspItems.Result items = FirstInspItems.load(jdbc, productCode);

        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", today);
        head.put("检验日期", today);
        head.put("工单号", woNo);
        head.put("工单行号", xc);
        head.put("产品编码", productCode);
        head.put("产品名称", line.get("mc"));
        head.put("规格型号", line.get("gg"));
        if (!str(line.get("lot")).isEmpty()) head.put("批次号", line.get("lot"));
        if (!str(line.get("khdm")).isEmpty()) head.put("客户代码", line.get("khdm"));
        if (!str(line.get("khmc")).isEmpty()) head.put("客户名称", line.get("khmc"));
        String prodLine = str(line.get("scx"));
        if (!prodLine.isEmpty()) {
            head.put("生产线", prodLine);
            // 车间是产线的属性(bs_prod_line.生产车间);反查不到就留空,不阻断建单
            List<String> shop = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL(生产车间,N'') FROM dbo.bs_prod_line WHERE 生产线=?", String.class, prodLine);
            if (!shop.isEmpty() && !shop.get(0).isBlank()) head.put("生产车间", shop.get(0));
        }
        if (items.docNo() != null) head.put("工艺清单单号", items.docNo());
        head.put("检验员", currentUser());
        head.put("detail", Map.of("items", items.rows()));
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
