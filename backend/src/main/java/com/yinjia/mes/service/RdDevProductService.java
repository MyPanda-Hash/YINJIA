package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 项目管理 ↔ 产品开发的关联视图(2026-10-16 用户口径)。
 *
 * <p>业务链:立项申请通过 → 判断产品值得开发 → 在「产品信息表」录要开发的产品数据 → 四个受控文件
 * (规格书/成型工艺清单/组装工艺清单/出货检验计划表)逐个开发 → 全部开发完毕。
 * 一个立项可以开发**多个**产品,产品编号各不相同(唯一性在 ButtonService 保存路径上拦)。
 *
 * <p>关联键 = **立项申请的「文档编号」**:
 * <ul>
 *   <li>RD_PLAN.文档编号 参照它;RD_PROGRESS 每行的 [项目编号]/[说明] 存的就是它(见 syncPlanToProgress);</li>
 *   <li>RD_PROD_INFO.立项文档编号(2026-10-16 加列)指回它;</li>
 *   <li>四个受控文件用 [产品编号] 关联到产品信息表。</li>
 * </ul>
 *
 * <p>本类只做**读**(概览视图 + 每个产品的四文件流程节点状态),供:
 * 项目进度查询列表上的「开发产品」按钮/状态、以及那个流程结构弹窗。
 * 「反审核」也纳入状态:弃审会让单据回到草稿(未完成),节点显示 ⚠已反审核待重走 ——
 * 依据是 yj_form_approval 里的 UNAUDIT 留痕(ButtonService.unaudit 写入)。
 */
@Service
public class RdDevProductService {

    private final JdbcTemplate jdbc;
    private final PanelRegistry registry;
    private final ButtonService buttons;

    /** 四个受控文件(顺序=开发顺序,与设计「文件汇总表」一致) */
    private static final String[][] DEV_FILES = {
            {"RD_SPEC_DOC", "规格书"},
            {"RD_MOLD_PROC", "成型工艺清单"},
            {"RD_ASM_PROC", "组装工艺清单"},
            {"RD_INSP_PLAN", "出货检验计划表"},
    };

    public RdDevProductService(JdbcTemplate jdbc, PanelRegistry registry, ButtonService buttons) {
        this.jdbc = jdbc;
        this.registry = registry;
        this.buttons = buttons;
    }

    /**
     * 概览:项目进度查询列表与「开发产品」弹窗共用一份数据。
     * 返回 { plans: {文档编号: 状态}, products: [ {…, nodes:[…]} ] }。
     */
    public Map<String, Object> overview() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("plans", planStatusByDocNo());
        out.put("products", productRows());
        return out;
    }

    /** 项目实施计划:文档编号 → 单据状态(同一文档编号多张时取最新一张;供「计划归档才能开发产品」判定) */
    private Map<String, Object> planStatusByDocNo() {
        Map<String, Object> out = new LinkedHashMap<>();
        List<Map<String, Object>> plans = jdbc.queryForList(
                "SELECT p.[文档编号] AS docNo, p.[单据编号] AS no FROM rd_plan p"
                        + " LEFT JOIN yj_doc_status s ON s.panel_code = 'RD_PLAN' AND s.doc_no = p.[单据编号]"
                        + " WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(s.canceled,'N') <> 'Y'"
                        + " AND ISNULL(p.[文档编号],N'') <> N''"
                        + " ORDER BY p.id");
        for (Map<String, Object> p : plans) {
            String docNo = str(p.get("docNo"));
            String no = str(p.get("no"));
            if (docNo == null || no == null) continue;
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("单据编号", no);
            one.put("state", statusOf("RD_PLAN", no));
            out.put(docNo, one); // 后写覆盖:ORDER BY id 升序 ⇒ 留下最新一张
        }
        return out;
    }

    /** 全部产品信息表(未作废)+ 每个产品的四文件流程节点 */
    private List<Map<String, Object>> productRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        // 老库可能还没有 立项文档编号 列(迁移未跑):缺列时退化为空串,不让整个接口 500
        boolean hasLink = hasColumn("rd_prod_info_head", "立项文档编号");
        String linkSel = hasLink ? "ISNULL([立项文档编号],N'')" : "N''";
        List<Map<String, Object>> pis = jdbc.queryForList(
                "SELECT [单据编号] AS no, ISNULL([产品编号],N'') AS code, ISNULL([产品名称],N'') AS name,"
                        + " ISNULL([客户项目名称],N'') AS project, " + linkSel + " AS linkNo"
                        + " FROM rd_prod_info_head h WHERE ISNULL(h.asp_cancel,'N') <> 'Y'"
                        + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'RD_PROD_INFO'"
                        + " AND s.doc_no = h.[单据编号] AND ISNULL(s.canceled,'N') = 'Y')"
                        + " ORDER BY h.id");
        for (Map<String, Object> pi : pis) {
            String no = str(pi.get("no"));
            String code = str(pi.get("code"));
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("单据编号", no);
            one.put("产品编号", code == null ? "" : code);
            one.put("产品名称", str(pi.get("name")) == null ? "" : str(pi.get("name")));
            one.put("立项文档编号", str(pi.get("linkNo")) == null ? "" : str(pi.get("linkNo")));
            one.put("项目名称", str(pi.get("project")) == null ? "" : str(pi.get("project")));
            one.put("state", statusOf("RD_PROD_INFO", no));
            List<Map<String, Object>> nodes = new ArrayList<>();
            int done = 0;
            for (String[] f : DEV_FILES) {
                Map<String, Object> n = nodeOf(f[0], f[1], code);
                if (Boolean.TRUE.equals(n.get("done"))) done++;
                nodes.add(n);
            }
            one.put("nodes", nodes);
            one.put("doneCount", done);
            one.put("allDone", done == DEV_FILES.length);
            rows.add(one);
        }
        return rows;
    }

    /** 某个产品在某个文件面板上的节点:单号/状态/是否完成/是否反审核待重走 */
    private Map<String, Object> nodeOf(String panelCode, String label, String productCode) {
        Map<String, Object> n = new LinkedHashMap<>();
        n.put("panel", panelCode);
        n.put("label", label);
        n.put("docNo", "");
        n.put("state", "未开始");
        n.put("done", false);
        n.put("reaudited", false);
        if (productCode == null || productCode.isBlank()) return n;
        try {
            PanelRegistry.PanelDef def = registry.panel(panelCode);
            if (def == null || !hasColumn(def.headTable(), "产品编号")) return n;
            List<Map<String, Object>> ds = jdbc.queryForList(
                    "SELECT TOP 1 h.[单据编号] AS no FROM " + def.headTable() + " h"
                            + " LEFT JOIN yj_doc_status s ON s.panel_code = ? AND s.doc_no = h.[单据编号]"
                            + " WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(s.canceled,'N') <> 'Y'"
                            + " AND h.[产品编号] = ? ORDER BY h.id DESC",
                    panelCode, productCode);
            if (ds.isEmpty()) return n;
            String no = str(ds.get(0).get("no"));
            String st = statusOf(panelCode, no);
            n.put("docNo", no == null ? "" : no);
            n.put("state", st);
            n.put("done", "已归档".equals(st) || "已审核".equals(st) || "已生效".equals(st));
            n.put("reaudited", !Boolean.TRUE.equals(n.get("done")) && hasUnaudit(panelCode, no));
        } catch (Exception ignore) {
            // 面板/表缺失等一律退化成「未开始」,不因一个节点把整份概览打挂
        }
        return n;
    }

    /** 该单是否有「弃审」留痕(有 = 曾经审过又被反审核,现处于未完成态 ⇒ 需要重走)。
     *  ⚠ 列名是 form_no 不是 doc_no(2026-10-16 实测:写错列名被 catch 吞掉,反审核标记永远 false)。 */
    private boolean hasUnaudit(String panelCode, String no) {
        if (no == null || no.isBlank()) return false;
        try {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM yj_form_approval WHERE panel_code = ? AND form_no = ? AND action = 'UNAUDIT'",
                    Integer.class, panelCode, no);
            return n != null && n > 0;
        } catch (Exception e) {
            return false;
        }
    }

    /** 走 ButtonService 的统一状态推导(草稿/审批中/待二级审批/已归档/修改中/已作废…),保证与界面一致 */
    private String statusOf(String panelCode, String no) {
        try {
            Object st = buttons.docStatus(panelCode, no).get("status");
            return st == null ? "" : String.valueOf(st);
        } catch (Exception e) {
            return "";
        }
    }

    private boolean hasColumn(String table, String col) {
        try {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(?) AND name = ?",
                    Integer.class, table, col);
            return n != null && n > 0;
        } catch (Exception e) {
            return false;
        }
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isEmpty() ? null : s;
    }
}
