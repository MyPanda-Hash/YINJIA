package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.PanelRegistry;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 出货检验（功能/表观）判定「不合格」→ 开不合格品处理单（2026-11-20 用户口径;2026-11-24 起按来源分流:
 * 功能 → 制程 QC_BHC、表观 → 成品 QC_BHCP）。
 *
 * <p>用户原话:「品质相关所有检验记录选择不合格都需要跳转至相关流程单据，当前出货检验（功能）就是转到
 * 不合格处理（制程）……为当前不合格处理（制程）的单据增加字段可关联到出货检验(功能）和对应的生产工单。」
 * 追问后确认:①入口只做出货检验（功能）/（表观）两张;②纸面判定不合格时出「去开不合格处理单」按钮,
 * 点击跳到对应处理单新单并自动带出 本检验单号 + 工单号 + 工单行号 + 批次号(保存仍由用户点)。</p>
 *
 * <p><b>为什么走专用接口而不是前端直接带参数跳转</b>:</p>
 * <ol>
 *   <li><b>幂等</b>:同一张检验单只能有一张存活的不合格品处理单(按 {@code qc_bhc.出货检验单号}),
 *       重复点按钮直接回到原来那张,避免现场反复点出一堆空白处理单;</li>
 *   <li><b>判定以库里为准</b>:「总结论=不合格」由服务端复核,前端就算被改也开不出单;</li>
 *   <li><b>带数据</b>:客户/产品/工单/不合格数量/生产量 按检验单带过来(口径同 2026-11-01
 *       不合格报告→不合格品处理单 的「能关联单号并带入数据即可」)。</li>
 * </ol>
 *
 * <p><b>权限</b>:同时要求 ①来源检验单可见(按钮本来就只下发到这两张)②不合格品处理单可见 ——
 * 否则会造出调用者自己都打不开的单。</p>
 */
@RestController
@RequestMapping("/api/qc/shipInsp")
public class QcShipInspNgController {

    /**
     * 目标单据按来源分流(2026-11-24):功能 → 不合格品处理单(制程) {@code QC_BHC};
     * 表观 → 不合格品处理单(成品) {@code QC_BHCP}。逐条登记见 {@link #SOURCES}。
     */

    /**
     * 来源检验单:面板码 → 表头/明细表 + 明细里的不合格数量列名 + **目标处理单**。
     *
     * <p>⚠ 明细列名不统一(功能单=不良数量、表观单=不合格数量),同 {@code WorkOrderInspectionService}
     * 的登记口径一致 —— 逐表登记,不写死一列。</p>
     *
     * <p>2026-11-24 用户口径:「当前的功能就转向当前的不合格处理(制程),表观就转向不合格处理(成品)」
     * ⇒ 目标按来源分流:功能 QC_PROC_INSP → 制程 QC_BHC;表观 QC_ASM_INSP → 成品 QC_BHCP。
     * 两张处理单都带 工单号 + 工单行号 + 批次号,产成品入库扣减就是按这三键归集的。</p>
     */
    private record Source(String panel, String label, String headTable, String detailTable, String ngColumn,
                          String target, String targetTable) {}

    private static final List<Source> SOURCES = List.of(
            new Source("QC_PROC_INSP", "出货检验（功能）", "qc_proc_insp_head", "qc_proc_insp_detail", "不良数量",
                    "QC_BHC", "qc_bhc"),
            new Source("QC_ASM_INSP", "出货检验（表观）", "qc_asm_insp_head", "qc_asm_insp_detail", "不合格数量",
                    "QC_BHCP", "qc_bhc_cp"));

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;
    private final PanelRegistry registry;
    private final ButtonService buttonService;

    public QcShipInspNgController(JdbcTemplate jdbc, PanelPermissionService perm,
                                  PanelRegistry registry, ButtonService buttonService) {
        this.jdbc = jdbc;
        this.perm = perm;
        this.registry = registry;
        this.buttonService = buttonService;
    }

    /**
     * 判定不合格 → 取/建**对应**不合格品处理单草稿(功能→制程 QC_BHC / 表观→成品 QC_BHCP)。
     *
     * @param body {@code {面板:'QC_PROC_INSP'|'QC_ASM_INSP', 单据编号:'ZC-...'}}
     * @return {@code {编号, gotoPanel:'QC_BHC'|'QC_BHCP', 已存在:true|false}} —— 前端按既有 gotoPanel 分支打开该单
     */
    @PostMapping("/ng")
    @Transactional
    public ApiResult<Map<String, Object>> ng(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        String panel = str(b.get("面板")).toUpperCase(Locale.ROOT);
        Source src = SOURCES.stream().filter((s) -> s.panel().equals(panel)).findFirst().orElse(null);
        if (src == null) return ApiResult.error(400, "只支持「出货检验（功能）/（表观）」两张检验单");
        String no = str(b.get("单据编号"));
        if (no.isEmpty()) return ApiResult.error(400, "缺少单据编号");

        // 双闸门:来源单 + 目标单都要看得见,否则造出来的单调用者自己打不开
        perm.requirePanelView(src.panel());
        perm.requirePanelView(src.target());

        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT [单据编号] AS 单据编号, ISNULL([总结论], N'') AS 总结论,"
                        + " ISNULL([工单号], N'') AS 工单号, ISNULL([客户名称], N'') AS 客户名称,"
                        + " ISNULL([产品编码], N'') AS 产品编码, ISNULL([产品名称], N'') AS 产品名称,"
                        + " ISNULL([规格型号], N'') AS 规格型号, [检验数量] AS 检验数量, [抽检总量] AS 抽检总量,"
                        // 2026-11-24:工单行号必须在这里取出来 —— 产成品入库按「工单号+工单行号」归集不合格数量,
                        //   漏了它(lineNo 恒 null)会让新处理单永远按整工单归集,多行工单会把同一笔
                        //   不合格数量重复扣到每一行入库草稿上。
                        + " ISNULL([工单行号], 0) AS 工单行号,"
                        + " ISNULL([批次号], N'') AS 批次号, ISNULL([报工单号], N'') AS 报工单号"
                        + " FROM dbo." + src.headTable()
                        + " WHERE [单据编号] = ? AND ISNULL(asp_cancel, 'N') <> 'Y'", no);
        if (heads.isEmpty()) return ApiResult.error(404, src.label() + " " + no + " 不存在或已作废");
        Map<String, Object> h = heads.get(0);
        if (!"不合格".equals(str(h.get("总结论")))) {
            return ApiResult.error(422, "本单检验结论不是「不合格」，不能开不合格品处理单");
        }
        // 工单行号(检验单头就有;历史单可能为 0/空 ⇒ 由产成品入库按「工单号」兜底归集)
        Integer lineNo = intOf(h.get("工单行号"));
        // 批次(完工日 yyyyMMdd):先吃检验单头的 批次号,空则按 报工单号 → scjl 的完工日推导
        String batch = str(h.get("批次号"));
        if (batch.isEmpty()) batch = batchOfReport(str(h.get("报工单号")));

        // 幂等:同一张检验单已有一张存活的目标处理单 → 直接回那张(不重复建单)
        List<String> existed = jdbc.queryForList(
                "SELECT TOP 1 [单据编号] FROM dbo." + src.targetTable()
                        + " WHERE [出货检验单号] = ? AND ISNULL(asp_cancel, 'N') <> 'Y' ORDER BY id DESC",
                String.class, no);
        if (!existed.isEmpty()) return ApiResult.ok(created(existed.get(0), true, src.target()));

        BigDecimal ngQty = ngQtyOf(src, no);
        BigDecimal total = qtyOf(h.get("检验数量"));
        if (total == null) total = qtyOf(h.get("抽检总量"));

        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", LocalDate.now().toString());
        head.put("出货检验单号", no);
        head.put("工单号", str(h.get("工单号")));
        if (lineNo != null) head.put("工单行号", lineNo);
        if (!batch.isEmpty()) head.put("批次号", batch);
        head.put("客户名称", str(h.get("客户名称")));
        head.put("产品编码", str(h.get("产品编码")));
        head.put("产品名称", str(h.get("产品名称")));
        head.put("产品规格", str(h.get("规格型号")));
        if (total != null) head.put("生产量", total);
        if (ngQty != null) {
            head.put("不合格品数量", ngQty);
            if (total != null && total.signum() > 0) {
                head.put("不合格品比例", ngQty.multiply(BigDecimal.valueOf(100))
                        .divide(total, 1, RoundingMode.HALF_UP).toPlainString() + "%");
            }
        }
        head.put("detail", Map.of("items", List.of()));
        Map<String, Object> saved = buttonService.save(registry.panel(src.target()), head, false);
        String newNo = str(saved.get("编号"));
        if (newNo.isEmpty()) return ApiResult.error(500, "不合格品处理单建单失败，请重试");
        return ApiResult.ok(created(newNo, false, src.target()));
    }

    /** 报工单号 → 该笔报工的完工日(批次号 yyyyMMdd;口径同产成品入库自动分批) */
    private String batchOfReport(String reportNo) {
        if (reportNo == null || reportNo.isBlank()) return "";
        try {
            List<String> v = jdbc.queryForList(
                    "SELECT TOP 1 CONVERT(varchar(8), COALESCE(wgsj, sc_date), 112) FROM dbo.scjl"
                            + " WHERE ([报工单号] = ? OR sc_no = ?) AND ISNULL(asp_cancel, 'N') <> 'Y'"
                            + "   AND COALESCE(wgsj, sc_date) IS NOT NULL ORDER BY id DESC",
                    String.class, reportNo, reportNo);
            return v.isEmpty() ? "" : str(v.get(0));
        } catch (RuntimeException e) {
            return "";
        }
    }

    private static Integer intOf(Object o) {
        BigDecimal v = qtyOf(o);
        return v == null ? null : v.intValue();
    }

    /** 明细里各行的不合格数量合计(空 = 明细没有数量,前端不填 0) */
    private BigDecimal ngQtyOf(Source src, String no) {
        try {
            BigDecimal v = jdbc.queryForObject(
                    "SELECT SUM(ISNULL([" + src.ngColumn() + "], 0)) FROM dbo." + src.detailTable()
                            + " WHERE [单据编号] = ? AND ISNULL(asp_cancel, 'N') <> 'Y'",
                    BigDecimal.class, no);
            return v != null && v.signum() > 0 ? v : null;
        } catch (RuntimeException e) {
            // 老库/裁剪库可能没有该列(迁移未跑):不阻断开单,数量留给填单人自己填
            return null;
        }
    }

    private static BigDecimal qtyOf(Object o) {
        if (o == null) return null;
        if (o instanceof BigDecimal bd) return bd;
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        String s = String.valueOf(o).trim();
        if (s.isEmpty()) return null;
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 前端按既有 gotoPanel 通用分支跳转到该单(2026-11-24 起:功能→制程 QC_BHC、表观→成品 QC_BHCP) */
    private static Map<String, Object> created(String no, boolean existed, String target) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", no);
        out.put("gotoPanel", target);
        out.put("已存在", existed);
        return out;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
