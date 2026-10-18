package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工序检验单的**数据驱动出单**深模块(2026-10-18)。
 *
 * <h3>为什么要它</h3>
 * 手机端(PDA/小程序/参考库)报工是**直连数据库写 {@code scjl}** 的,不生成 MES 的报工单、更不会走审核。
 * 原来的检验单只挂在 {@code ButtonService.runWoAuditHooks}(报工单审核)上 ⇒ 手机端报工**永远不会出检验单**
 * (实测 2026-10-18 备份库:GD-2026-10-0011 成型/切炭/组装各 270 件全部直写完工,首件/制程/组装三张单一张都没有)。
 *
 * <p>用户口径(2026-10-18):
 * 「手机端报工是直接写入当前数据库表……检验单生成的形式修改为当前**排产转产线**相同的形式实现,
 * 只要当前报工数量达到当前要求就可以进入到下一步。」
 * ⇒ 判据从「有没有报工单审核」改成「**该工序累计已报工量是否达到该道计划量**」,
 * 与 {@code ProcessTaskService.applyNextProcess}(转序)同一个达标口径:
 * 数据一满足就出单,不需要任何单据动作。</p>
 *
 * <h3>触发面(两处共用,禁止各写一份)</h3>
 * <ol>
 *   <li>手机端报工吸收 {@link ExternalReportAbsorbService} —— 每吸收一行成功后调用;</li>
 *   <li>MES 报工单审核 {@code ButtonService.woInspGenerate} —— 审核后按同一判据出单。</li>
 * </ol>
 * 本类**只判定 + 组装单头**(纯查询,无写库),保存与占用链由调用方做 —— 这样它不依赖
 * {@code ButtonService}(那边依赖本类,反向依赖会成环)。
 *
 * <h3>工序 → 检验单</h3>
 * <ul>
 *   <li>{@code 成型} 累计达计划量 ⇒ 首件检验单 {@code QC_FIRST_INSP} + 制程检验单 {@code QC_PROC_INSP};</li>
 *   <li>{@code 组装} 累计达计划量 ⇒ 组装成品检验单 {@code QC_ASM_INSP};</li>
 *   <li>切炭/混料/装箱不出单(2026-10-16 成型/切炭两张工序检验单已下架;混料/装箱无载体)。</li>
 * </ul>
 *
 * <h3>计划量取数(逐级兜底,取不到不瞎猜)</h3>
 * ① 预排台账 {@code wo_process_line.计划数量}(该工单行该工序);
 * ② 工单行 {@code plang.pl_sl} × 工艺路线 {@code bs_route.换算率};
 * ③ 都为 0 ⇒ 不做数量门禁(有已报工就出单),与旧行为一致 —— 老工单没有台账时不会永远出不了单。
 *
 * <h3>幂等</h3>
 * 唯一键 = {@code (工单号, 工单行号)} × 面板;已有存活单则跳过(作废后可再次生成)。
 */
@Service
public class QcInspAutoService {

    /** 一张待保存的检验单草稿(调用方负责 save + 写占用链) */
    public record Draft(String panelCode, Map<String, Object> head) {}

    /**
     * 一次判定的结果。
     *
     * @param drafts 要生成的草稿(空 = 不生成)
     * @param reason 不生成时的原因(界面/回执直接显示;生成为空串)
     * @param op     报工工序
     * @param done   该工序累计已报工量
     * @param plan   该工序计划量(0 = 无数量门禁)
     */
    public record Result(List<Draft> drafts, String reason, String op, double done, double plan) {
        public boolean empty() { return drafts.isEmpty(); }
    }

    /** 工序 → 检验单面板(顺序即出单顺序;改口径只改这一处) */
    private static final Map<String, List<String>> OP_PANELS = Map.of(
            "成型", List.of("QC_FIRST_INSP", "QC_PROC_INSP"),
            "组装", List.of("QC_ASM_INSP"));

    /** 面板 → 头表(幂等查重;取值全是本类常量,无拼接注入面) */
    private static final Map<String, String> HEAD_TABLE = Map.of(
            "QC_FIRST_INSP", "qc_first_insp_head",
            "QC_PROC_INSP", "qc_proc_insp_head",
            "QC_ASM_INSP", "qc_asm_insp_head");

    private final JdbcTemplate jdbc;

    public QcInspAutoService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 按一条报工行判定并组装检验单草稿。
     *
     * @param scjlId 报工行 id({@code scjl.id});调用方已确认该行未作废
     * @param repNo  报工单号(手机端直写时为空串;仅用于表头留痕)
     * @param user   检验员(= 触发人/吸收人)
     */
    public Result build(long scjlId, String repNo, String user) {
        Map<String, Object> r = loadReportRow(scjlId);
        if (r == null) return new Result(List.of(), "报工行不存在或已作废", "", 0, 0);

        String wo = str(r.get("工单号"));
        String op = str(r.get("工序"));
        if (wo.isEmpty() || op.isEmpty()) {
            return new Result(List.of(), "报工行缺工单号/工序,无法判定", op, 0, 0);
        }
        List<String> panels = OP_PANELS.get(op);
        if (panels == null || panels.isEmpty()) {
            return new Result(List.of(), "工序「" + op + "」不出检验单", op, 0, 0);
        }

        int xc = (int) num(r.get("行号"));
        Map<String, Object> p = resolvePlangRow(wo, xc, (long) num(r.get("gd_id")), str(r.get("批次号")));
        if (p == null) {
            return new Result(List.of(), "定位不到唯一工单行(缺工单行号/gd_id,批次也不唯一),暂不出单", op, 0, 0);
        }
        long rowId = (long) num(p.get("id"));
        if (xc == 0) xc = (int) num(p.get("pl_xc"));

        double plan = planQty(wo, rowId, op, p);
        double done = WoInspGate.reportedQty(jdbc, wo, rowId, op);
        boolean reached = plan <= 0 ? done > 0 : done + 0.0001 >= plan;
        if (!reached) {
            return new Result(List.of(),
                    "该工序累计已报工 " + trim(done) + " < 计划 " + trim(plan) + ",未达标暂不出单",
                    op, done, plan);
        }
        // 保留 2026-10-19 的工序前置:成型未达标 ⇒ 后面的单也不出(除非本道就是成型,或路线没有成型 = 免门禁)。
        // 手机端直写可以跳过「不得跳序」,这里必须自己兜住。
        if (!"成型".equals(op)) {
            double moldPlan = planQty(wo, rowId, "成型", p);
            double moldDone = WoInspGate.reportedQty(jdbc, wo, rowId, "成型");
            if (moldPlan > 0 && moldDone + 0.0001 < moldPlan) {
                return new Result(List.of(),
                        "成型累计已报工 " + trim(moldDone) + " < 计划 " + trim(moldPlan) + ",成型未达标暂不出单",
                        op, done, plan);
            }
        }

        List<Draft> drafts = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        for (String panel : panels) {
            if (existsLive(panel, wo, xc)) {
                skipped.add(panel);
                continue;
            }
            drafts.add(new Draft(panel, head(panel, r, p, op, xc, done, repNo, user)));
        }
        String reason = drafts.isEmpty()
                ? "已达计划量,但 " + String.join("/", skipped) + " 已有存活单(幂等跳过)"
                : "";
        return new Result(drafts, reason, op, done, plan);
    }

    // ────────────────────────────── 单头组装 ──────────────────────────────

    private Map<String, Object> head(String panel, Map<String, Object> r, Map<String, Object> p,
                                     String op, int xc, double done, String repNo, String user) {
        return switch (panel) {
            case "QC_FIRST_INSP" -> firstInspHead(r, p, op, xc, done, repNo, user);
            case "QC_PROC_INSP" -> procInspHead(p, xc, done, op, repNo, user);
            case "QC_ASM_INSP" -> asmInspHead(r, p, op, xc, done, repNo, user);
            default -> Map.of();
        };
    }

    /**
     * 首件检验单(与 {@code ButtonService.firstInspGenerate} 原实现同一套字段):
     * 头照抄报工行 + 工单行;明细按《成型工艺清单》RD_MOLD_PROC 预铺;
     * 生产日期/批号由工单行**首批完工**时回填(见 {@link FirstInspBackfill}),出单时不写死今天。
     */
    private Map<String, Object> firstInspHead(Map<String, Object> r, Map<String, Object> p, String op,
                                              int xc, double done, String repNo, String user) {
        String today = LocalDate.now().toString();
        String wo = str(r.get("工单号"));
        String productCode = firstNonBlank(str(r.get("产品编码")), str(p.get("dm")));
        String batch = str(r.get("批次号"));

        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", today);
        head.put("检验日期", today);
        head.put("工单号", wo);
        if (xc != 0) head.put("工单行号", xc);
        if (!repNo.isBlank()) head.put("报工单号", repNo);
        head.put("工序", op);
        head.put("批次号", batch);
        long rowId = (long) num(p.get("id"));
        Map<String, String> completed = FirstInspBackfill.completedBatch(jdbc, rowId);
        if (completed != null) {
            if (!completed.get("批次号").isBlank()) head.put("批次号", completed.get("批次号"));
            head.put("生产日期", completed.get("生产日期"));
        }
        head.put("产品编码", productCode);
        head.put("产品名称", firstNonBlank(str(r.get("产品名称")), str(p.get("mc"))));
        String spec = firstNonBlank(str(r.get("规格型号")), str(p.get("gg")));
        if (!spec.isEmpty()) head.put("规格型号", spec);
        String custCode = str(p.get("客户代码"));
        if (!custCode.isEmpty()) head.put("客户代码", custCode);
        String custName = str(p.get("客户名称"));
        if (!custName.isEmpty()) head.put("客户名称", custName);
        String line = firstNonBlank(str(r.get("生产线")), str(p.get("scx")));
        if (!line.isEmpty()) {
            head.put("生产线", line);
            String shop = lineShop(line);
            if (shop != null) head.put("生产车间", shop);
        }
        head.put("报工数量", round(done));
        FirstInspItems.Result items = FirstInspItems.load(jdbc, productCode);
        if (items.docNo() != null) head.put("工艺清单单号", items.docNo());
        head.put("检验员", user);
        head.put("detail", Map.of("items", items.rows()));
        return head;
    }

    /** 制程检验单(与 {@code QcProcInspController.fromWoLine} 同一套字段;明细留空由品质带入) */
    private Map<String, Object> procInspHead(Map<String, Object> p, int xc, double done, String op,
                                             String repNo, String user) {
        String today = LocalDate.now().toString();
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", today);
        head.put("检验日期", today);
        head.put("工单号", str(p.get("pl_no")));
        if (xc != 0) head.put("工单行号", xc);
        head.put("工序", op);
        if (!repNo.isBlank()) head.put("报工单号", repNo);
        head.put("报工数量", round(done));
        head.put("产品编码", str(p.get("dm")));
        head.put("产品名称", str(p.get("mc")));
        String spec = str(p.get("gg"));
        if (!spec.isEmpty()) head.put("规格型号", spec);
        String batch = str(p.get("批次号"));
        if (!batch.isEmpty()) head.put("批次号", batch);
        String line = str(p.get("scx"));
        if (!line.isEmpty()) {
            head.put("生产线", line);
            String shop = lineShop(line);
            if (shop != null) head.put("生产车间", shop);
        }
        head.put("检验类别", "制程检验");
        head.put("检验员", user);
        head.put("detail", Map.of("items", List.of()));
        return head;
    }

    /** 组装成品检验单(与 {@code ButtonService.woInspGenerate} 原组装分支同一套字段;明细按出货检验计划预铺) */
    private Map<String, Object> asmInspHead(Map<String, Object> r, Map<String, Object> p, String op,
                                            int xc, double done, String repNo, String user) {
        String today = LocalDate.now().toString();
        String productCode = firstNonBlank(str(r.get("产品编码")), str(p.get("dm")));
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", today);
        head.put("工单号", str(r.get("工单号")));
        if (xc != 0) head.put("工单行号", xc);
        if (!repNo.isBlank()) head.put("报工单号", repNo);
        head.put("工序", op);
        String batch = str(r.get("批次号"));
        if (!batch.isEmpty()) head.put("批次号", batch);
        head.put("产品编码", productCode);
        head.put("产品名称", firstNonBlank(str(r.get("产品名称")), str(p.get("mc"))));
        String spec = firstNonBlank(str(r.get("规格型号")), str(p.get("gg")));
        if (!spec.isEmpty()) head.put("规格型号", spec);
        String line = firstNonBlank(str(r.get("生产线")), str(p.get("scx")));
        if (!line.isEmpty()) {
            head.put("生产线", line);
            String shop = lineShop(line);
            if (shop != null) head.put("生产车间", shop);
        }
        head.put("报工数量", round(done));
        head.put("检验日期", today);
        head.put("检验员", user);
        AsmInspItems.Result items = AsmInspItems.load(jdbc, productCode);
        head.put("detail", Map.of("items", items.rows()));
        return head;
    }

    // ────────────────────────────── 取数 ──────────────────────────────

    private Map<String, Object> loadReportRow(long scjlId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT s.id, ISNULL(s.gldh,N'') AS 工单号, ISNULL(s.gxdm,N'') AS 工序, ISNULL(s.sl,0) AS 数量,"
                        + " ISNULL(s.[批次号],N'') AS 批次号, ISNULL(s.[工单行号],0) AS 行号,"
                        + " ISNULL(s.gd_id,0) AS gd_id, ISNULL(s.[报工单号],N'') AS 报工单号,"
                        + " ISNULL(s.scx,N'') AS 生产线, ISNULL(s.wzdm,N'') AS 产品编码,"
                        + " ISNULL(s.mc,N'') AS 产品名称, ISNULL(s.gg,N'') AS 规格型号"
                        + " FROM dbo.scjl s WHERE s.id=? AND ISNULL(s.asp_cancel,'N')<>'Y'",
                scjlId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 工单行定位(三级,与 {@code ExternalReportAbsorbService.resolveRow} 同口径):
     * ① 工单号 + 工单行号 → ② gd_id → plang_pc.plang_id → ③ 工单号 + 批次号(恰一行才认)。
     */
    private Map<String, Object> resolvePlangRow(String wo, int xc, long gdId, String batch) {
        String cols = "SELECT p.id, ISNULL(p.pl_no,N'') AS pl_no, ISNULL(p.pl_xc,0) AS pl_xc,"
                + " ISNULL(p.dm,N'') AS dm, ISNULL(p.mc,N'') AS mc,"
                + " ISNULL(p.gg,N'') AS gg, ISNULL(p.scx,N'') AS scx, ISNULL(p.khdm,N'') AS 客户代码,"
                + " ISNULL(dk.mc,N'') AS 客户名称, ISNULL(p.[工艺路线],N'') AS 工艺路线,"
                + " ISNULL(p.pl_sl,0) AS pl_sl, ISNULL(p.[批次号],N'') AS 批次号"
                + " FROM dbo.plang p LEFT JOIN dbo.dm_kh dk ON dk.dm = p.khdm";
        // ① gd_id 最可靠(手机端报工自带 plang_pc.id;2026-10-18 实测同工单存在两行「行号=1」,
        //    只按行号会选到旧行 ⇒ 计划量/批次全错)。
        if (gdId > 0) {
            List<Map<String, Object>> r = jdbc.queryForList(
                    cols + " JOIN dbo.plang_pc pc ON pc.plang_id = p.id"
                            + " WHERE pc.id=? AND ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(pc.asp_cancel,'N')<>'Y'",
                    gdId);
            if (!r.isEmpty()) return r.get(0);
        }
        // ② 工单号 + 工单行号(恰一行才认;多行说明数据有重复,交给 gd_id/批次)
        if (xc > 0) {
            List<Map<String, Object>> r = jdbc.queryForList(
                    cols + " WHERE p.pl_no=? AND ISNULL(p.pl_xc,0)=? AND ISNULL(p.asp_cancel,'N')<>'Y' ORDER BY p.id",
                    wo, xc);
            if (r.size() == 1) return r.get(0);
        }
        // ③ 工单号 + 批次号(恰一行才认)
        if (!batch.isBlank()) {
            List<Map<String, Object>> r = jdbc.queryForList(
                    cols + " WHERE p.pl_no=? AND ISNULL(p.[批次号],N'')=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                            + " ORDER BY p.id", wo, batch);
            if (r.size() == 1) return r.get(0);
        }
        return null;
    }

    /**
     * 该工单行该道工序的**计划量**:①预排台账 → ②排产数量×路线换算率 → ③0(不做数量门禁)。
     */
    private double planQty(String wo, long rowId, String op, Map<String, Object> p) {
        try {
            List<Double> ledger = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL(计划数量,0) FROM dbo.wo_process_line"
                            + " WHERE 工单号=? AND 工单行id=? AND 工序=? AND ISNULL(asp_cancel,'N')<>'Y'",
                    Double.class, wo, rowId, op);
            if (!ledger.isEmpty() && ledger.get(0) != null && ledger.get(0) > 0) {
                return round(ledger.get(0));
            }
        } catch (Exception e) {
            // 台账缺列/缺表不阻断出单,退到路线换算率
        }
        double plSl = num(p.get("pl_sl"));
        if (plSl <= 0) return 0;
        double rate = 1;
        String route = str(p.get("工艺路线"));
        if (!route.isBlank()) {
            try {
                List<Double> rs = jdbc.queryForList(
                        "SELECT TOP 1 ISNULL(换算率,1) FROM dbo.bs_route"
                                + " WHERE 工艺路线编码=? AND 工序名称=? AND ISNULL(asp_cancel,'N')<>'Y'",
                        Double.class, route, op);
                if (!rs.isEmpty() && rs.get(0) != null && rs.get(0) > 0) rate = rs.get(0);
            } catch (Exception e) {
                rate = 1;
            }
        }
        return round(plSl * rate);
    }

    /** 该面板在该工单行上是否已有存活单(幂等键 = 工单号 + 工单行号) */
    private boolean existsLive(String panel, String wo, int xc) {
        String table = HEAD_TABLE.get(panel);
        if (table == null) return false;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo." + table + " WHERE 工单号=? AND ISNULL(工单行号,0)=?"
                        + " AND ISNULL(asp_cancel,'N')<>'Y'",
                Integer.class, wo, xc);
        return n != null && n > 0;
    }

    /** 产线 → 生产车间(bs_prod_line 的属性;查不到返回 null,不阻断建单) */
    private String lineShop(String line) {
        if (line == null || line.isBlank()) return null;
        List<String> s = jdbc.queryForList(
                "SELECT TOP 1 ISNULL(生产车间,N'') FROM dbo.bs_prod_line WHERE 生产线=? AND ISNULL(asp_cancel,'N')<>'Y'",
                String.class, line);
        return s.isEmpty() || s.get(0).isBlank() ? null : s.get(0);
    }

    private static String firstNonBlank(String a, String b) {
        return a == null || a.isBlank() ? (b == null ? "" : b) : a;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String trim(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v);
    }

    private static double round(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}
