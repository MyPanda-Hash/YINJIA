package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产工单「转领料单」(2026-10-07 建;2026-10-09 **粒度修正:按工单行**)。
 *
 * <p><b>唯一键 = 工单号 + 工单行号</b>(与排产/转序/报工/切单同一口径;物理落点是 {@code plang.id})。
 * 修正前按**工单号**去重并把该单所有行并成一张,后果是「同一张工单的第二行再也转不出领料单」
 * (用户报障:相同工单号只能生成一次)—— 现在**每一行各转各的**:
 * 勾选 N 行 → N 张草稿(同一行被勾两次仍只转一张)。
 *
 * <p>系统里的领料单就是材料出库单({@code bd_material_out} 头 + {@code bl_material_out} 行,
 * 对口金蝶「生产领料单」{@code /jdy/v2/scm/inv_pick});单据头挂
 * {@code 加工单号 = 工单号} + {@code 工单行号 = plang.pl_xc},因此审核出库后
 * {@link ManuWritebackService} 能**按行**把领料单号回写到 {@code plang.ll_no2}
 * (工单列表「领料单号」列随之逐行点亮)。
 *
 * <p><b>明细为什么留空</b>:原「转领料」按产品**默认 BOM × 排产数量**展开材料行
 * ({@code WoPickingHandler} / 旧 {@code ScheduleBoardService.toPicking}),该能力已随 MES 自建
 * 「物料清单(BOM)」下架(2026-10-04:表 {@code bs_bom}+视图 {@code v_wo_kit}+面板一并删除)而消失;
 * 实测库里再无可用材料来源 —— 配方/工艺清单表({@code rd_mold_formula_*} / {@code rd_*_proc_detail})
 * 全为 0 行,遗留 {@code mate}(物料清单)是光缆旧数据、与现产品 0 命中。故本按钮只**转单头**
 * (日期/业务类型/出库类别/加工单号/工单行号/来源单/车间/领用人),材料行由仓库在材料出库单面板按实发补,
 * 补完审核即回写工单 —— 不做"猜材料"的自动展开。
 *
 * <p><b>防重复</b>(两层,均可自愈,均**按行**):
 * ① 占用链 {@code form_flow_link}(PLANG→MATERIAL_OUT,ACTIVE,{@code source_line_key = 工单号#行id})
 * —— 删除/作废下游草稿时 {@code ButtonService} 自动置 RELEASED,来源行随即放开;
 * ② 存量兜底:该**行**已有未审核领料单时拒绝(含手工建的;**工单级**单据即工单行号空/0 时视为占整单)。
 * 已审核的**不拦**(分批领料是真实场景,回写侧按「每行最近已审核最多 3 张」汇总)。
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

    /** 工单行:唯一键 = 工单号 + 工单行号,物理落点 = plang.id(切单/多批次下同一单号多行) */
    private record Line(long id, String no, int xc, String batch, String dm, String scx, double plSl) {
        String label() {
            return batch == null || batch.isBlank() ? no + "#" + xc : no + "#" + xc + "/" + batch;
        }
    }

    /**
     * 批量转领料单:**入参 = 列表勾选行,按「工单号 + 工单行号」逐行转**(同一行勾两次只转一张)。
     *
     * @return {转领料单张数, 单号清单:["工单号#行号→领料单号"], 失败行, gotoPanel}
     */
    public Map<String, Object> toPicking(List<Map<String, Object>> rows, String user) {
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请先勾选要转领料单的工单");
        // 勾选行 → 具体工单行(按 plang.id 去重):同单不同行各转一张,同一行只转一张
        LinkedHashMap<Long, Line> lines = new LinkedHashMap<>();
        List<String> failed = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String no = orderNoOf(r);
            if (no == null) { failed.add("勾选行缺少工单号"); continue; }
            try {
                Line ln = resolveLine(no, r);
                lines.putIfAbsent(ln.id(), ln);
            } catch (RuntimeException e) {
                failed.add(no + "#" + str(r.get("工单行号")) + ":" + msgOf(e));
            }
        }
        if (lines.isEmpty()) throw new IllegalStateException("无可转领料单的工单行:" + String.join("; ", failed));
        List<String> done = new ArrayList<>();
        for (Line ln : lines.values()) {
            try {
                done.add(ln.label() + "→" + pickOne(ln, user));
            } catch (RuntimeException e) {
                failed.add(ln.label() + ":" + msgOf(e));
            }
        }
        if (done.isEmpty()) throw new IllegalStateException("无工单行可转领料单:" + String.join("; ", failed));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("转领料单张数", done.size());
        out.put("单号清单", done);
        out.put("失败行", failed);
        out.put("gotoPanel", TARGET_PANEL);
        return out;
    }

    /**
     * 勾选行 → 工单行。优先用列表回传的**行id**(唯一键的物理落点,最准);
     * 缺行id 时按 工单号+工单行号(+批次号)反查 —— 反查命中多行(同单号同行号的不同批次)时拒绝,
     * 让调用方回列表重新勾选,不猜。
     */
    private Line resolveLine(String no, Map<String, Object> r) {
        Long id = longOf(r.get("行id"));
        if (id == null) {
            Integer xc = intOf(r.get("工单行号"));
            if (xc == null) throw new IllegalStateException("勾选行缺少工单行号");
            String batch = str(r.get("批次号"));
            String sql = "SELECT id FROM dbo.plang WHERE pl_no = ? AND pl_xc = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                    + (batch == null ? "" : " AND ISNULL([批次号], N'') = ?")
                    + " ORDER BY id";
            List<Long> ids = batch == null
                    ? jdbc.queryForList(sql, Long.class, no, xc)
                    : jdbc.queryForList(sql, Long.class, no, xc, batch);
            if (ids.isEmpty()) throw new IllegalStateException("工单行不存在或已作废");
            if (ids.size() > 1) throw new IllegalStateException("该工单号+行号对应多行(批次不同),请回列表勾选(带行id)");
            id = ids.get(0);
        }
        List<Map<String, Object>> hit = jdbc.queryForList(
                "SELECT id, pl_no, ISNULL(pl_xc, 0) AS xc, ISNULL([批次号], N'') AS batch,"
                        + " ISNULL(dm, N'') AS dm, ISNULL(scx, N'') AS scx, ISNULL(pl_sl, 0) AS pl_sl,"
                        + " ISNULL(ja, N'N') AS ja"
                        + " FROM dbo.plang WHERE id = ? AND ISNULL(asp_cancel,'N') <> 'Y'", id);
        if (hit.isEmpty()) throw new IllegalStateException("工单行不存在或已作废");
        Map<String, Object> h = hit.get(0);
        String ja = str(h.get("ja"));
        if ("T".equals(ja) || "Y".equals(ja)) throw new IllegalStateException("已结案,不能转领料单");
        if (num(h.get("pl_sl")) <= 0) throw new IllegalStateException("排产数量为 0(未排产),不能转领料单");
        return new Line(id, String.valueOf(h.get("pl_no")), intOf(h.get("xc")) == null ? 0 : intOf(h.get("xc")),
                str(h.get("batch")), str(h.get("dm")), str(h.get("scx")), num(h.get("pl_sl")));
    }

    /** 单个**工单行**转领料单(守卫 → 组装单头 → 落占用链;返回新领料单号) */
    private String pickOne(Line ln, String user) {
        // 1) 防重复①:本按钮生成过且草稿还在 —— 占用链**按行**判(source_line_key = 工单号#行id)
        List<String> linked = jdbc.queryForList(
                "SELECT target_form_no FROM form_flow_link WHERE source_panel_code = ? AND source_line_key = ?"
                        + " AND target_panel_code = ? AND link_status = 'ACTIVE'",
                String.class, SOURCE_PANEL, ln.no() + "#" + ln.id(), TARGET_PANEL);
        if (!linked.isEmpty()) {
            throw new IllegalStateException("该工单行已生成领料单 " + linked.get(0) + ",请先删除该草稿后再转");
        }
        // 2) 防重复②:存量未审核领料单兜底(含手工建的)—— 按 (加工单号 + 工单行号) 判;
        //    工单行号 空/0 = 工单级单据(没有行信息),保守地视为占整单,所有行都不放行。
        //    ⚠ **行号不唯一时不比行号**:plang 里同一工单号可以有**多行共用同一个 pl_xc**(同订单行分批转单,
        //      批次号不同 —— 实测 MO-2026-09-0006 有 4 行都是 pl_xc=1),那种行的真实身份只有 plang.id,
        //      按行号去比会把同单其它批次行连坐挡住 ⇒ 此时只认"工单级"单据 + 上面的按行占用链。
        Integer sameXc = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.plang WHERE pl_no = ? AND ISNULL(pl_xc,0) = ?"
                        + " AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class, ln.no(), ln.xc());
        boolean xcUnique = sameXc == null || sameXc <= 1;
        // ⚠ 参数按分支**逐个列出**(与类内既有 queryForList(sql, String.class, ?…) 同形):
        //   把 Object[] 直接喂给可变参数位会被重载解析挑成 queryForList(String, Object…)
        //   ⇒ 编译期报「List<Map> 不能转 List<String>」(2026-10-09 实测踩到)。
        String pendSql = "SELECT TOP 1 h.[单据编号] FROM bd_material_out h"
                + " WHERE h.[加工单号] = ? AND ISNULL(h.asp_cancel,'N') <> 'Y'"
                + "   AND (ISNULL(h.[工单行号], 0) = 0" + (xcUnique ? " OR h.[工单行号] = ?" : "") + ")"
                // ⚠ 已作废的草稿**不算存量**:删除即作废(yj_doc_status.canceled='Y'),
                //   少了这一条,「删掉草稿再重转」会被自己刚删的单挡住(2026-10-07 界面探针实测踩到)。
                + "   AND NOT EXISTS (SELECT 1 FROM yj_doc_status c WHERE c.panel_code = ?"
                + "     AND c.doc_no = h.[单据编号] AND ISNULL(c.canceled,'N') = 'Y')"
                // 未审核 = 不存在「已审核(s.shr 非空)且未作废」的状态行
                + "   AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = ?"
                + "     AND s.doc_no = h.[单据编号] AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N') <> 'Y')"
                + " ORDER BY h.[单据编号] DESC";
        List<String> pending = xcUnique
                ? jdbc.queryForList(pendSql, String.class, ln.no(), ln.xc(), TARGET_PANEL, TARGET_PANEL)
                : jdbc.queryForList(pendSql, String.class, ln.no(), TARGET_PANEL, TARGET_PANEL);
        if (!pending.isEmpty()) {
            throw new IllegalStateException("该工单行已有未审核领料单 " + pending.get(0) + ",请先审核或删除后再转");
        }

        // 3) 单头:与旧「转领料」同口径(单据日期=今天、业务类型=材料出库、出库类别=直接领料、
        //    车间=产线档案属性 2026-09-23 口径)+ 来源单信息 + **工单行号**(2026-10-09 粒度修正的锚)。
        //    ⚠ 不预填「仓库」:档案里没有旧代码写死的「材料仓」(实为不存在的仓库),领用哪个仓
        //      取决于实发材料(原料仓/辅料仓),留给仓库选;同理明细行也由仓库补。
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", LocalDate.now().toString());
        head.put("业务类型", "材料出库");
        head.put("出库类别", "直接领料");
        head.put("加工单号", ln.no());
        head.put("工单行号", ln.xc());
        head.put("来源单据", "生产工单");
        head.put("来源单号", ln.no());
        String workshop = workshopOf(ln.scx());
        if (workshop != null) head.put("生产车间", workshop);
        head.put("领用人", realName(user));
        //    同单号多行共用同一行号时(分批转单)**备注带批次号**,否则两张单在界面上分不出是哪一批。
        head.put("备注", "生产工单转领料单(工单行 " + ln.xc()
                + (ln.batch() == null ? "" : ",批次 " + ln.batch())
                + ",排产 " + round4(ln.plSl()) + ");材料明细由仓库补填");

        // 4) 建草稿:明细留空 —— ButtonService.save 的"空白草稿"分支只写单头(号池取号 CL-…/草稿态)
        Map<String, Object> formData = new LinkedHashMap<>(head);
        formData.put("detail", Map.of("items", List.of()));
        Map<String, Object> saved = buttonService.save(registry.panel(TARGET_PANEL), formData, false);
        String newNo = String.valueOf(saved.get("编号"));

        // 5) 占用链:**只落这一行**(源行键 = 工单号#行id,与选单同一 lineKey 约定);目标暂无行 ⇒ targetLineKey=null。
        //    下游草稿删除/作废时 ButtonService 会把 link 置 RELEASED,本按钮随之重新可点(零回滚代码)。
        voucherFlow.linkLine(SOURCE_PANEL, ln.no(), ln.no() + "#" + ln.id(), ln.dm(), ln.plSl(),
                TARGET_PANEL, newNo, null, null);
        return newNo;
    }

    /** 车间 = 产线档案属性(bs_prod_line.生产车间;与旧转领料/加工单口径同源) */
    private String workshopOf(String line) {
        if (line == null) return null;
        List<String> w = jdbc.queryForList(
                "SELECT TOP 1 ISNULL([生产车间], N'') FROM bs_prod_line"
                        + " WHERE [生产线] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", String.class, line);
        if (!w.isEmpty() && w.get(0) != null && !w.get(0).isBlank()) return w.get(0).trim();
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

    /** 勾选行的工单号(列表回传 工单号;老调用方可能只给 加工单号) */
    private static String orderNoOf(Map<String, Object> r) {
        String no = str(r.get("工单号"));
        return no == null ? str(r.get("加工单号")) : no;
    }

    private static String msgOf(RuntimeException e) {
        return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
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

    private static Integer intOf(Object o) {
        if (o instanceof Number n) return n.intValue();
        if (o == null) return null;
        try { return (int) Double.parseDouble(String.valueOf(o).trim()); } catch (Exception e) { return null; }
    }

    private static Long longOf(Object o) {
        if (o instanceof Number n) return n.longValue();
        if (o == null) return null;
        try { return (long) Double.parseDouble(String.valueOf(o).trim()); } catch (Exception e) { return null; }
    }

    private static double round4(double v) { return Math.round(v * 10000d) / 10000d; }
}
