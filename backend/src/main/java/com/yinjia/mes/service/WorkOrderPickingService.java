package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * 生产工单「转领料单」(2026-10-07,生产工单列表页按钮由「打印领料单」改来)。
 *
 * <p>口径:勾选工单(plang 行)→ 按**工单号去重**逐张生成「材料出库单」草稿 —— 系统里的领料单
 * 就是材料出库单({@code bd_material_out} 头 + {@code bl_material_out} 行,对口金蝶「生产领料单」
 * {@code /jdy/v2/scm/inv_pick}),单据头挂 {@code 加工单号 = 工单号},因此审核出库后
 * {@link ManuWritebackService} 会自动把领料单号回写到工单({@code plang.ll_no2},工单列表「领料单号」列随之点亮)。
 *
 * <p><b>明细为什么留空</b>:原「转领料」按产品**默认 BOM × 排产数量**展开材料行
 * ({@code WoPickingHandler} / 旧 {@code ScheduleBoardService.toPicking}),该能力已随 MES 自建
 * 「物料清单(BOM)」下架(2026-10-04:表 {@code bs_bom}+视图 {@code v_wo_kit}+面板一并删除)而消失;
 * 实测库里再无可用材料来源 —— 配方/工艺清单表({@code rd_mold_formula_*} / {@code rd_*_proc_detail})
 * 全为 0 行,遗留 {@code mate}(物料清单)是光缆旧数据、与现产品 0 命中。故本按钮只**转单头**
 * (日期/业务类型/出库类别/加工单号/来源单/车间/领用人),材料行由仓库在材料出库单面板按实发补,
 * 补完审核即回写工单 —— 不做"猜材料"的自动展开。
 *
 * <p><b>防重复</b>(两层,均可自愈):① 占用链 {@code form_flow_link}(PLANG→MATERIAL_OUT,ACTIVE)
 * —— 删除/作废下游草稿时 {@code ButtonService} 自动置 RELEASED,来源行随即放开;② 存量兜底:
 * 该工单已有**未审核**领料单时拒绝(含手工建的),已审核的**不拦**(分批领料是真实场景,
 * 回写侧同样按「最近已审核最多 3 张」汇总)。
 *
 * <p>⚠ **不加 {@code @Transactional}**(沿用 2026-09-26 toManu 的教训):外层事务与
 * {@code buttonService.save} 自带的事务嵌套时,某一行失败会把共享事务标 rollback-only,
 * 导致"其余行明明成功却被一起回滚"。故逐张独立提交、失败行进 {@code 失败行} 回执。
 */
@Service
public class WorkOrderPickingService {

    /** 目标面板:材料出库单(= 领料单) */
    private static final String TARGET_PANEL = "MATERIAL_OUT";
    /** 来源面板码:工单落参考库表 plang(非注册面板,故占用链走 linkLine 逐行落,不用 link 的整单映射) */
    private static final String SOURCE_PANEL = "PLANG";

    private final JdbcTemplate jdbc;
    private final PanelRegistry registry;
    private final ButtonService buttonService;
    private final VoucherFlowService voucherFlow;

    public WorkOrderPickingService(JdbcTemplate jdbc, PanelRegistry registry, ButtonService buttonService,
                                   VoucherFlowService voucherFlow) {
        this.jdbc = jdbc;
        this.registry = registry;
        this.buttonService = buttonService;
        this.voucherFlow = voucherFlow;
    }

    /**
     * 批量转领料单:入参 = 列表勾选行(只需 工单号;同单号多批次行自动并成一张单)。
     *
     * @return {转领料单张数, 单号清单:["工单号→领料单号"], 失败行, gotoPanel}
     */
    public Map<String, Object> toPicking(List<Map<String, Object>> rows, String user) {
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请先勾选要转领料单的工单");
        LinkedHashSet<String> nos = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) {
            String no = str(r.get("工单号"));
            if (no == null) no = str(r.get("加工单号"));
            if (no != null) nos.add(no);
        }
        if (nos.isEmpty()) throw new IllegalArgumentException("转领料单的行缺少工单号");
        List<String> done = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (String no : nos) {
            try {
                done.add(no + "→" + pickOne(no, user));
            } catch (RuntimeException e) {
                failed.add(no + ":" + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
            }
        }
        if (done.isEmpty()) throw new IllegalStateException("无工单可转领料单:" + String.join("; ", failed));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("转领料单张数", done.size());
        out.put("单号清单", done);
        out.put("失败行", failed);
        out.put("gotoPanel", TARGET_PANEL);
        return out;
    }

    /** 单张工单转领料单(守卫 → 组装单头 → 落占用链;返回新领料单号) */
    private String pickOne(String no, String user) {
        // 1) 工单(plang 可能多批次行):必须存在·未作废·未结案;领料针对整张工单 ⇒ 排产量取各行合计
        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT p.id AS 行id, ISNULL(p.dm, N'') AS dm, ISNULL(p.scx, N'') AS scx,"
                        + " ISNULL(p.pl_sl, 0) AS pl_sl, ISNULL(p.ja, N'N') AS ja"
                        + " FROM dbo.plang p WHERE p.pl_no = ? AND ISNULL(p.asp_cancel,'N') <> 'Y' ORDER BY p.pl_xc, p.[批次号]",
                no);
        if (heads.isEmpty()) throw new IllegalStateException("工单不存在或已作废");
        for (Map<String, Object> h : heads) {
            String ja = str(h.get("ja"));
            if ("T".equals(ja) || "Y".equals(ja)) throw new IllegalStateException("已结案,不能转领料单");
        }
        double qty = heads.stream().mapToDouble(h -> num(h.get("pl_sl"))).sum();
        if (qty <= 0) throw new IllegalStateException("排产数量为 0(未排产),不能转领料单");

        // 2) 防重复(两层):① 本按钮生成过且草稿还在(占用链 ACTIVE)② 存量未审核领料单兜底(含手工建的)
        List<String> linked = jdbc.queryForList(
                "SELECT target_form_no FROM form_flow_link WHERE source_panel_code = ? AND source_form_no = ?"
                        + " AND target_panel_code = ? AND link_status = 'ACTIVE'",
                String.class, SOURCE_PANEL, no, TARGET_PANEL);
        if (!linked.isEmpty()) {
            throw new IllegalStateException("已生成领料单 " + linked.get(0) + ",请先删除该草稿后再转");
        }
        List<String> pending = jdbc.queryForList(
                "SELECT TOP 1 h.[单据编号] FROM bd_material_out h"
                        + " WHERE h.[加工单号] = ? AND ISNULL(h.asp_cancel,'N') <> 'Y'"
                        // ⚠ 已作废的草稿**不算存量**:删除即作废(yj_doc_status.canceled='Y'),
                        //   少了这一条,「删掉草稿再重转」会被自己刚删的单挡住(2026-10-07 界面探针实测踩到)。
                        + "   AND NOT EXISTS (SELECT 1 FROM yj_doc_status c WHERE c.panel_code = ?"
                        + "     AND c.doc_no = h.[单据编号] AND ISNULL(c.canceled,'N') = 'Y')"
                        // 未审核 = 不存在「已审核(s.shr 非空)且未作废」的状态行
                        + "   AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = ?"
                        + "     AND s.doc_no = h.[单据编号] AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N') <> 'Y')"
                        + " ORDER BY h.[单据编号] DESC",
                String.class, no, TARGET_PANEL, TARGET_PANEL);
        if (!pending.isEmpty()) {
            throw new IllegalStateException("该工单已有未审核领料单 " + pending.get(0) + ",请先审核或删除后再转");
        }

        // 3) 单头:与旧「转领料」同口径(单据日期=今天、业务类型=材料出库、出库类别=直接领料、
        //    车间=产线档案属性 2026-09-23 口径)+ 来源单信息。
        //    ⚠ 不预填「仓库」:档案里没有旧代码写死的「材料仓」(实为不存在的仓库),领用哪个仓
        //      取决于实发材料(原料仓/辅料仓),留给仓库选;同理明细行也由仓库补。
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", LocalDate.now().toString());
        head.put("业务类型", "材料出库");
        head.put("出库类别", "直接领料");
        head.put("加工单号", no);
        head.put("来源单据", "生产工单");
        head.put("来源单号", no);
        String workshop = workshopOf(heads);
        if (workshop != null) head.put("生产车间", workshop);
        head.put("领用人", realName(user));
        head.put("备注", "生产工单转领料单(排产 " + round4(qty) + ");材料明细由仓库补填");

        // 4) 建草稿:明细留空 —— ButtonService.save 的"空白草稿"分支只写单头(号池取号 CL-…/草稿态)
        Map<String, Object> formData = new LinkedHashMap<>(head);
        formData.put("detail", Map.of("items", List.of()));
        Map<String, Object> saved = buttonService.save(registry.panel(TARGET_PANEL), formData, false);
        String newNo = String.valueOf(saved.get("编号"));

        // 5) 占用链:按工单行逐行落(源行键 = 工单号#行id,与选单同一 lineKey 约定);目标暂无行 ⇒ targetLineKey=null。
        //    下游草稿删除/作废时 ButtonService 会把 link 置 RELEASED,本按钮随之重新可点(零回滚代码)。
        for (Map<String, Object> h : heads) {
            voucherFlow.linkLine(SOURCE_PANEL, no, no + "#" + intOf(h.get("行id")), str(h.get("dm")),
                    num(h.get("pl_sl")), TARGET_PANEL, newNo, null, null);
        }
        return newNo;
    }

    /** 车间 = 产线档案属性(bs_prod_line.生产车间;与旧转领料/加工单口径同源);取第一条非空产线 */
    private String workshopOf(List<Map<String, Object>> heads) {
        for (Map<String, Object> h : heads) {
            String line = str(h.get("scx"));
            if (line == null) continue;
            List<String> w = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL([生产车间], N'') FROM bs_prod_line"
                            + " WHERE [生产线] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", String.class, line);
            if (!w.isEmpty() && w.get(0) != null && !w.get(0).isBlank()) return w.get(0).trim();
        }
        return null;
    }

    /** 操作人姓名(yj_user.real_name;查不到退回登录名)—— 领用人的默认值,仓库可改 */
    private String realName(String user) {
        try {
            List<String> r = jdbc.queryForList("SELECT TOP 1 real_name FROM yj_user WHERE username = ?",
                    String.class, user);
            if (!r.isEmpty() && r.get(0) != null && !r.get(0).isBlank()) return r.get(0).trim();
        } catch (Exception ignore) { /* 取不到就用登录名 */ }
        return user;
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isBlank() ? null : s;
    }

    private static double num(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        if (o == null) return 0;
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return 0; }
    }

    private static int intOf(Object o) {
        if (o instanceof Number n) return n.intValue();
        try { return (int) Double.parseDouble(String.valueOf(o).trim()); } catch (Exception e) { return 0; }
    }

    private static double round4(double v) { return Math.round(v * 10000d) / 10000d; }
}
