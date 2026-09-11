package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 产品开发下发(2026-09-09)。
 *
 * 业务:产品信息表(RD_PROD_INFO)归档后,可点侧边栏「产品开发」把该产品下发到 5 个下游文件面板,
 * 下游据此开展研发设计。下发记录写 rd_dev_task(产品 × 面板);
 * 开发状态不存表,查询时从下游单据 + yj_doc_status 实时推导,避免与单据脱节。
 *
 * 状态口径(取最高进度,单调不回退):
 *   已归档 → 开发完毕 | 审批中 → 开发审核中 | 有草稿 → 开发中 | 无单据 → 未开发
 *
 * 产品键不统一:规格书用「编号」(语义即产品编号),其余用「产品编号」。
 *
 * 2026-09-11:成型配方(RD_MOLD_FORMULA)并入成型工艺清单第 2 页签、组装BOM表(RD_ASM_BOM)并入
 * 组装工艺清单第 2 页签,菜单下线 —— 下游面板矩阵从 5 列收敛为 **4 列**(成型工艺清单/组装工艺清单/
 * 规格书/出货检验计划表)。组装工艺清单原先不在矩阵里(它没有「产品编号」列,推导不出状态),
 * 当日随合并补齐 RD_ASM_PROC.产品编号(参照 RD_PROD_INFO)后正式入列。
 * 历史 rd_dev_task 行仍指向 RD_MOLD_FORMULA/RD_ASM_BOM(不删,留审计),只是不再参与矩阵统计。
 */
@Service
public class DevTaskService {

    /** 下游面板 → { 表名, 产品键字段, 显示名 }(顺序即矩阵列顺序) */
    private static final Map<String, String[]> DEV_PANELS = new LinkedHashMap<>();
    /** 面板 → 产品键字段 */
    private static final Map<String, String> PRODUCT_KEY = new HashMap<>();

    static {
        DEV_PANELS.put("RD_MOLD_PROC", new String[]{"rd_mold_proc_head", "产品编号", "成型工艺清单"});
        DEV_PANELS.put("RD_ASM_PROC", new String[]{"rd_asm_proc_head", "产品编号", "组装工艺清单"});
        DEV_PANELS.put("RD_SPEC_DOC", new String[]{"rd_spec_doc_head", "编号", "规格书"});
        DEV_PANELS.put("RD_INSP_PLAN", new String[]{"rd_insp_plan_head", "产品编号", "出货检验计划表"});
        DEV_PANELS.forEach((code, v) -> PRODUCT_KEY.put(code, v[1]));
    }

    public static final String STATUS_NONE = "未开发";
    public static final String STATUS_DOING = "开发中";
    public static final String STATUS_REVIEW = "开发审核中";
    public static final String STATUS_DONE = "开发完毕";
    public static final String STATUS_DISPATCHED = "已下发";

    private final JdbcTemplate jdbc;

    public DevTaskService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static Set<String> devPanelCodes() {
        return DEV_PANELS.keySet();
    }

    public static String productKeyOf(String panelCode) {
        return PRODUCT_KEY.get(panelCode);
    }

    public static List<Map<String, String>> devPanelMeta() {
        List<Map<String, String>> out = new ArrayList<>();
        DEV_PANELS.forEach((code, v) -> {
            Map<String, String> m = new LinkedHashMap<>();
            m.put("panelCode", code);
            m.put("panelName", v[2]);
            out.add(m);
        });
        return out;
    }

    /** 该产品是否已下发过(按产品编号判定,不按单据) */
    public boolean dispatched(String productCode) {
        if (productCode == null || productCode.isBlank()) return false;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM rd_dev_task WHERE 产品编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                Integer.class, productCode);
        return n != null && n > 0;
    }

    /** 该产品已下发的目标面板集合 */
    public Set<String> dispatchedPanels(String productCode) {
        Set<String> out = new LinkedHashSet<>();
        if (productCode == null || productCode.isBlank()) return out;
        jdbc.queryForList(
                        "SELECT 目标面板 FROM rd_dev_task WHERE 产品编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                        String.class, productCode)
                .forEach(out::add);
        return out;
    }

    /**
     * 下发:把产品写到 5 个下游面板。已下发过的产品直接返回 already=true(幂等)。
     * 仅允许对「已归档」的产品信息表单据下发,由调用方(ButtonService)校验。
     */
    @Transactional
    public Map<String, Object> dispatch(String productCode, String productName, String sourceDocNo, String user) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (productCode == null || productCode.isBlank()) {
            throw new IllegalArgumentException("产品编号为空,无法下发");
        }
        if (dispatched(productCode)) {
            out.put("already", true);
            out.put("productCode", productCode);
            out.put("panels", dispatchedPanels(productCode));
            return out;
        }
        LocalDateTime now = LocalDateTime.now();
        for (Map.Entry<String, String[]> e : DEV_PANELS.entrySet()) {
            jdbc.update("INSERT INTO rd_dev_task (产品编号,产品名称,源单据号,目标面板,下发人,下发时间,asp_user1,asp_time1) "
                            + "VALUES (?,?,?,?,?,?,?,?)",
                    productCode, productName, sourceDocNo, e.getKey(), user, now, user, now);
        }
        out.put("already", false);
        out.put("productCode", productCode);
        out.put("panels", DEV_PANELS.keySet());
        return out;
    }

    /** 单产品 × 单面板的开发状态(实时推导) */
    public String statusOf(String productCode, String panelCode) {
        String[] meta = DEV_PANELS.get(panelCode);
        if (meta == null || productCode == null || productCode.isBlank()) return STATUS_NONE;
        String table = meta[0];
        String key = meta[1];
        Integer lvl = jdbc.queryForObject(
                "SELECT ISNULL(MAX(CASE WHEN ISNULL(s.archived,'N')='Y' THEN 3"
                        + " WHEN ISNULL(s.pending,'N')='Y' THEN 2 ELSE 1 END), 0) "
                        + "FROM " + table + " h "
                        + "LEFT JOIN yj_doc_status s ON s.panel_code = ? AND s.doc_no = h.单据编号 "
                        + "WHERE h." + key + " = ? AND ISNULL(h.asp_cancel,'N') <> 'Y' "
                        + "AND ISNULL(s.canceled,'N') <> 'Y'",
                Integer.class, panelCode, productCode);
        int v = lvl == null ? 0 : lvl;
        return switch (v) {
            case 3 -> STATUS_DONE;
            case 2 -> STATUS_REVIEW;
            case 1 -> STATUS_DOING;
            default -> STATUS_NONE;
        };
    }

    /**
     * 该产品在该面板的参照标注:未下发 → 空(不标注,不属于下发流程);
     * 已下发 → 未开发 / 已开发。
     */
    public String annotate(String productCode, String panelCode) {
        if (productCode == null || productCode.isBlank()) return "";
        if (!dispatchedTo(productCode, panelCode)) return "";
        String st = statusOf(productCode, panelCode);
        return STATUS_NONE.equals(st) ? STATUS_NONE : "已开发";
    }

    /** 该产品是否已下发到指定面板 */
    public boolean dispatchedTo(String productCode, String panelCode) {
        if (productCode == null || productCode.isBlank()) return false;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM rd_dev_task WHERE 产品编号 = ? AND 目标面板 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                Integer.class, productCode, panelCode);
        return n != null && n > 0;
    }

    /** 批量标注:产品编号列表 → { 未开发 | 已开发 } */
    public Map<String, String> annotateBatch(String panelCode, List<String> productCodes) {
        Map<String, String> out = new LinkedHashMap<>();
        if (productCodes == null) return out;
        for (String code : productCodes) {
            if (code == null || code.isBlank()) continue;
            out.put(code, annotate(code, panelCode));
        }
        return out;
    }

    /** 已下发产品的开发矩阵:一行 = 一个产品,列 = 5 个下游面板 */
    public List<Map<String, Object>> board() {
        List<Map<String, Object>> tasks = jdbc.queryForList(
                "SELECT 产品编号, MAX(产品名称) AS 产品名称, MAX(源单据号) AS 源单据号,"
                        + " MAX(下发人) AS 下发人, MAX(下发时间) AS 下发时间"
                        + " FROM rd_dev_task WHERE ISNULL(asp_cancel,'N') <> 'Y'"
                        + " GROUP BY 产品编号 ORDER BY MAX(下发时间) DESC");
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> t : tasks) {
            String productCode = String.valueOf(t.get("产品编号"));
            Map<String, Object> row = new LinkedHashMap<>(t);
            Map<String, String> cells = new LinkedHashMap<>();
            int done = 0;
            int doing = 0;
            for (String panel : DEV_PANELS.keySet()) {
                String st = statusOf(productCode, panel);
                cells.put(panel, st);
                if (STATUS_DONE.equals(st)) done++;
                else if (!STATUS_NONE.equals(st)) doing++;
            }
            row.put("cells", cells);
            row.put("doneCount", done);
            row.put("totalCount", DEV_PANELS.size());
            row.put("overall", done >= DEV_PANELS.size() ? STATUS_DONE
                    : (done + doing > 0 ? STATUS_DOING : STATUS_NONE));
            out.add(row);
        }
        return out;
    }

    /** 产品信息表侧边栏「产品开发」按钮状态:disabled / dispatched / ready */
    public Map<String, Object> buttonState(String productCode) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("productCode", productCode == null ? "" : productCode);
        out.put("dispatched", dispatched(productCode));
        return out;
    }

    /** 待办/通知:已下发但本面板仍未开发的产品(按面板可见范围过滤,由调用方传面板集合) */
    public List<Map<String, Object>> pendingFor(List<String> visiblePanels, int limit) {
        if (visiblePanels == null || visiblePanels.isEmpty()) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (String panel : DEV_PANELS.keySet()) {
            if (!visiblePanels.contains("*") && !visiblePanels.contains(panel)) continue;
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT DISTINCT 产品编号, 产品名称, 源单据号, 下发人, 下发时间 FROM rd_dev_task "
                            + "WHERE 目标面板 = ? AND ISNULL(asp_cancel,'N') <> 'Y' "
                            + "ORDER BY 下发时间 DESC", panel);
            for (Map<String, Object> r : rows) {
                String code = String.valueOf(r.get("产品编号"));
                String st = statusOf(code, panel);
                if (STATUS_NONE.equals(st)) {
                    Map<String, Object> item = new LinkedHashMap<>(r);
                    item.put("panelCode", panel);
                    item.put("panelName", DEV_PANELS.get(panel)[2]);
                    item.put("status", st);
                    out.add(item);
                    if (out.size() >= limit) return out;
                }
            }
        }
        return out;
    }
}
