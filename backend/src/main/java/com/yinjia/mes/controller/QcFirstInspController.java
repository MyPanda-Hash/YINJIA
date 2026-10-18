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
 * 报工审核自动出单时已经按《成型工艺清单》RD_MOLD_PROC 预铺过检验项目(见
 * {@code ButtonService.firstInspGenerate});本接口是**同一个来源的手动入口** —— 工艺清单当时还没维护、
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

    /** 可选的生产工单行(未作废、未结案;ja Y/T 皆属结案口径)。与制程检验单同一套取数口径。 */
    @GetMapping("/woLines")
    public ApiResult<Map<String, Object>> woLines(@RequestParam(required = false) String keyword,
                                                  @RequestParam(defaultValue = "1") int pageNo,
                                                  @RequestParam(defaultValue = "20") int pageSize) {
        perm.requirePanelView(PANEL);
        String kw = keyword == null ? "" : keyword.trim();
        int size = Math.max(1, Math.min(200, pageSize));
        int page = Math.max(1, pageNo);

        StringBuilder where = new StringBuilder(" WHERE ISNULL(p.asp_cancel,'N')<>'Y'"
                + " AND " + com.yinjia.mes.service.PlangClose.notClosed("p") + "");
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
                        // 该行已有的存活首件检验单(列表上直接标「已建单」,并供幂等提示)
                        + " ISNULL((SELECT TOP 1 h.[单据编号] FROM dbo." + HEAD_TABLE + " h"
                        + "          WHERE h.[工单号]=p.pl_no AND h.[工单行号]=p.pl_xc"
                        + "            AND ISNULL(h.asp_cancel,'N')<>'Y'), N'') AS 已建单号"
                        + " FROM dbo.plang p" + where
                        + " ORDER BY p.pl_no DESC, p.pl_xc"
                        + " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                pageArgs.toArray());

        // 门禁(2026-10-19):与制程检验单**同一份实现、同一句话术**(WoInspGate + WoInspGateGuard),
        // 对应流程图「成型报工 → 成型质检数据」——首件检验单就是成型那道工序的质检数据。
        gate.decorate(rows);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", rows);
        out.put("totalSize", total == null ? 0 : total);
        out.put("gate", gate.meta(PANEL));      // 门禁档位 + 当前用户能否强制开单(弹窗顶部提示用)
        return ApiResult.ok(out);
    }

    /**
     * 按生产工单行生成一张首件检验单**草稿**:表头带 工单号/工单行号/产品/批次/产线/客户,
     * 明细按《成型工艺清单》(RD_MOLD_PROC)预铺 —— 与报工审核自动出单(ButtonService.firstInspGenerate)
     * 同一份实现,故手工建的单与自动出的单长得一样。
     *
     * <p><b>生产日期刻意留空</b>:按 2026-10-16 第二轮口径,它由「工单第一批完工」时回填
     * (见 {@code FirstInspBackfill}),出单时不写死今天。</p>
     *
     * <p>幂等:同一 (工单号, 工单行号) 已有存活首件检验单 ⇒ 直接返回那张,不重复建单。</p>
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
                        + "   AND " + com.yinjia.mes.service.PlangClose.notClosed("p") + "", woNo, xc);
        if (lines.isEmpty()) return ApiResult.error(400, "该生产工单行不存在、已作废或已结案：" + woNo + " #" + xc);
        Map<String, Object> line = lines.get(0);

        // 门禁(2026-10-19 用户口径「成型完成后的生产工单才能生成这个首件检验单」):
        //   与制程检验单同一份实现(WoInspGateGuard.enforce);前端虽已置灰,这里仍然硬校验,
        //   防直连接口绕过。强度档位(off/warn/block)、预警留痕、管理员强制开单都在那一处。
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
