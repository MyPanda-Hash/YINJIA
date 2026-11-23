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
        // 2026-11-11 用户口径(流程面板要显示每一步「谁在处理」):
        //   · 产品信息表 = **填写提交审批的人** ⇒ 制单人 asp_user1(→姓名)；
        //   · 规格书 = **产品信息表的二级负责人** ⇒ [审核人二级]，空了退 [责任人]（=产品负责人）；
        //   · 成型/组装/出货 = 产品信息表签核后**按文件分发**的负责人 ⇒ rd_dev_task.负责人；
        boolean hasL2 = hasColumn("rd_prod_info_head", "审核人二级");
        String l2Sel = hasL2 ? "ISNULL([审核人二级],N'')" : "N''";
        boolean hasDuty = hasColumn("rd_prod_info_head", "责任人");
        String dutySel = hasDuty ? "ISNULL([责任人],N'')" : "N''";
        List<Map<String, Object>> pis = jdbc.queryForList(
                "SELECT [单据编号] AS no, ISNULL([产品编号],N'') AS code, ISNULL([产品名称],N'') AS name,"
                        + " ISNULL([客户项目名称],N'') AS project, " + linkSel + " AS linkNo,"
                        + " ISNULL(h.asp_user1,N'') AS creator, " + l2Sel + " AS l2, " + dutySel + " AS duty"
                        + " FROM rd_prod_info_head h WHERE ISNULL(h.asp_cancel,'N') <> 'Y'"
                        + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'RD_PROD_INFO'"
                        + " AND s.doc_no = h.[单据编号] AND ISNULL(s.canceled,'N') = 'Y')"
                        // 2026-11-17 用户口径「新增的产品信息应该放最上面，不要放下面」:
                        //   按 id 倒序 ⇒ 最新建的那张产品信息表排第一行(旧口径 ORDER BY h.id 升序,新单沉底)
                        + " ORDER BY h.id DESC");
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
            // 处理人（2026-11-11）：第一步=填写并提交审批的人；规格书=二级负责人
            String filler = displayName(str(pi.get("creator")));
            String l2Owner = str(pi.get("l2"));
            if (l2Owner == null) l2Owner = str(pi.get("duty"));
            one.put("填写人", filler == null ? "" : filler);
            one.put("二级负责人", l2Owner == null ? "" : l2Owner);
            // 产品信息表这一步的最后操作时间(与 4 个文件节点同一口径,见 lastActionAt)
            one.put("at", lastActionAt("RD_PROD_INFO", no));
            // 2026-11-20：产品信息表这一步也要下发 actor。
            //   ⚠ 上一轮(2026-11-19)只给 nodeOf 的 4 个文件节点加了 actor，头表这行漏了 ⇒
            //   前端 flowStepsOf 读 row.actor 恒为空，步骤 ① 永远不显示填写人(生产实测复现)。
            one.put("actor", lastActorOf("RD_PROD_INFO", no));
            // 2026-11-23：产品信息表这一步同样要显示「谁提交、等谁审批 / 谁已审批通过」
            one.putAll(approvalInfoOf("RD_PROD_INFO", no));
            Map<String, String> owners = devTaskOwners();
            List<Map<String, Object>> nodes = new ArrayList<>();
            int done = 0;
            for (String[] f : DEV_FILES) {
                Map<String, Object> n = nodeOf(f[0], f[1], code);
                // 规格书：优先用产品信息表的二级负责人；成型/组装/出货：用分发给该文件的负责人
                String byTask = owners.get(f[0] + "|" + (code == null ? "" : code));
                String owner = "RD_SPEC_DOC".equals(f[0])
                        ? (l2Owner != null ? l2Owner : byTask)
                        : byTask;
                n.put("owner", owner == null ? "" : owner);
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

    /**
     * 每个产品、每份文件**分发到的负责人**（rd_dev_task.负责人，账号→姓名）。
     * key = `面板码|原始产品编号`（rd_dev_task 存的就是产品信息表的原始编号，不走 -tb 变体）。
     */
    private Map<String, String> devTaskOwners() {
        Map<String, String> out = new LinkedHashMap<>();
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT [产品编号] AS code, [目标面板] AS panel, [负责人] AS owner FROM rd_dev_task"
                            + " WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL([负责人],N'') <> N''"
                            + " ORDER BY id");
            for (Map<String, Object> r : rows) {
                String code = str(r.get("code"));
                String panel = str(r.get("panel"));
                String owner = str(r.get("owner"));
                if (code == null || panel == null || owner == null) continue;
                out.put(panel + "|" + code, displayName(owner));
            }
        } catch (Exception e) {
            // rd_dev_task 异常不该拦住整张流程图：处理人留空，其余照常
        }
        return out;
    }

    /** 账号 → 姓名；取不到姓名退回账号本身（历史单据的制单账号可能已不在 yj_user 里） */
    private String displayName(String username) {
        if (username == null || username.isBlank()) return null;
        try {
            List<String> rows = jdbc.queryForList(
                    "SELECT real_name FROM yj_user WHERE username = ?", String.class, username);
            String name = rows.isEmpty() ? null : str(rows.get(0));
            return name == null ? username : name;
        } catch (Exception e) {
            return username;
        }
    }

    /** 某个产品在某个文件面板上的节点:单号/状态/是否完成/是否反审核待重走/最后操作时间 */
    private Map<String, Object> nodeOf(String panelCode, String label, String productCode) {
        Map<String, Object> n = new LinkedHashMap<>();
        n.put("panel", panelCode);
        n.put("label", label);
        n.put("docNo", "");
        n.put("state", "未开始");
        n.put("done", false);
        n.put("reaudited", false);
        // 最后操作时间(2026-11-17 用户口径「每个都显示处理的日期，比如我是 2026年11月17日13:31分操作的」)。
        // 取不到就是空串,前端显示「—」,不编造时间。
        n.put("at", "");
        if (productCode == null || productCode.isBlank()) return n;
        // ⚠ 这里入参是**原始产品编号**(产品信息表/rd_dev_task 侧),而本层查的是 head 表 ——
        //   烧结工艺清单(RD_MOLD_PROC)存的是 `原值-tb`。只认一种形态 ⇒ 该类节点永远显示「未开始」,
        //   不报错、看起来像"还没建单"(2026-11-02 同类排查发现)。
        List<String> forms = DevTaskService.productCodeForms(productCode);
        if (forms.isEmpty()) return n;
        try {
            PanelRegistry.PanelDef def = registry.panel(panelCode);
            if (def == null || !hasColumn(def.headTable(), "产品编号")) return n;
            // 2026-11-19 用户口径：「一个项目下同类数据记录表可能有多张（同编号反复测试），
            //   流程里要都能看到」——原来 TOP 1 只显示最新一张。现在取**全部**单据，
            //   docs = [{no, state, done, at, actor}]；单值字段仍取最新一张（old 兼容）。
            List<Map<String, Object>> ds = jdbc.queryForList(
                    "SELECT h.[单据编号] AS no FROM " + def.headTable() + " h"
                            + " LEFT JOIN yj_doc_status s ON s.panel_code = ? AND s.doc_no = h.[单据编号]"
                            + " WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(s.canceled,'N') <> 'Y'"
                            + " AND h.[产品编号] IN (?, ?) ORDER BY h.id DESC",
                    panelCode, forms.get(0), forms.get(1));
            if (ds.isEmpty()) return n;
            java.util.List<Map<String, Object>> docs = new java.util.ArrayList<>();
            for (Map<String, Object> d : ds) {
                String dno = str(d.get("no"));
                if (dno == null || dno.isBlank()) continue;
                String dst = statusOf(panelCode, dno);
                Map<String, Object> one = new LinkedHashMap<>();
                one.put("no", dno);
                one.put("state", dst);
                one.put("done", "已归档".equals(dst) || "已审核".equals(dst) || "已生效".equals(dst));
                one.put("at", lastActionAt(panelCode, dno));
                one.put("actor", lastActorOf(panelCode, dno));
                // 2026-11-23：每张单都带「谁提交/谁审批」，展开行才看得出卡在谁手上
                one.putAll(approvalInfoOf(panelCode, dno));
                docs.add(one);
            }
            n.put("docs", docs);
            if (docs.isEmpty()) return n;
            String no = str(ds.get(0).get("no"));
            String st = statusOf(panelCode, no);
            n.put("docNo", no == null ? "" : no);
            n.put("state", st);
            n.put("done", "已归档".equals(st) || "已审核".equals(st) || "已生效".equals(st));
            n.put("reaudited", !Boolean.TRUE.equals(n.get("done")) && hasUnaudit(panelCode, no));
            n.put("at", lastActionAt(panelCode, no));
            // 2026-11-19 销售问题汇总 P14：「要跟项目查询一样，增加填写人名字」
            n.put("actor", lastActorOf(panelCode, no));
            // 2026-11-23：提交/审批两个人两个时间（展开行显示「谁提交、等谁审批 / 谁已审批通过」）
            n.putAll(approvalInfoOf(panelCode, no));
        } catch (Exception ignore) {
            // 面板/表缺失等一律退化成「未开始」,不因一个节点把整份概览打挂
        }
        return n;
    }

    /**
     * 单据的「谁提交、谁审批」两个人两个时间（2026-11-23 用户口径）。
     *
     * <p>用户原话：「产品进度查询，提交的单据，应该是要和立项申请表一样，可以再展开查看到
     * **谁提交了单据等待审批中，谁审批通过了**，现在只有进行中」——
     * 原先展开行只显示「进行中 / 填写人 / 最后操作时间」，看不出这道审批卡在谁手上、谁已经批过。</p>
     *
     * <p>取数口径（与 {@link #lastActorOf} 同源、各取各的，不互相顶替）：</p>
     * <ul>
     *   <li><b>提交</b>：{@code yj_form_approval} 最新一条 {@code action='SUBMIT'} 的 operator/create_time；
     *       老单没留痕时退回 {@code yj_doc_status.pending_by / pending_at}；</li>
     *   <li><b>审批</b>：{@code yj_doc_status.shr / shsj}（审批通过那一刻写的就是这两列）；
     *       老单没有时退回留痕里最新一条 {@code APPROVE}。</li>
     * </ul>
     *
     * <p>返回四个键 + {@code pending}：<b>没有就返回空串/false，不编造</b>（前端显示「—」）。</p>
     */
    private Map<String, Object> approvalInfoOf(String panelCode, String no) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("submitBy", "");
        out.put("submitAt", "");
        out.put("approveBy", "");
        out.put("approveAt", "");
        out.put("pending", false);
        if (panelCode == null || no == null || no.isBlank()) return out;
        // ① 提交留痕（最准：谁点的提交审批、几点几分）
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL(operator,N'') AS op, create_time AS at FROM yj_form_approval"
                            + " WHERE panel_code = ? AND form_no = ? AND action = N'SUBMIT'"
                            + " AND ISNULL(operator,'') <> '' ORDER BY id DESC", panelCode, no);
            if (!rows.isEmpty()) {
                out.put("submitBy", nullToEmpty(displayName(str(rows.get(0).get("op")))));
                out.put("submitAt", fmtObj(rows.get(0).get("at")));
            }
        } catch (Exception ignore) { /* 留痕表缺 ⇒ 退回状态表 */ }
        // ② 状态表：pending / pending_by / pending_at / shr / shsj
        try {
            List<Map<String, Object>> rs = jdbc.queryForList(
                    "SELECT pending, pending_by, pending_at, shr, shsj FROM yj_doc_status"
                            + " WHERE panel_code = ? AND doc_no = ?", panelCode, no);
            if (!rs.isEmpty()) {
                Map<String, Object> r = rs.get(0);
                out.put("pending", "Y".equalsIgnoreCase(str(r.get("pending"))));
                if (String.valueOf(out.get("submitBy")).isEmpty()) {
                    out.put("submitBy", nullToEmpty(displayName(str(r.get("pending_by")))));
                }
                if (String.valueOf(out.get("submitAt")).isEmpty()) {
                    out.put("submitAt", fmtObj(r.get("pending_at")));
                }
                out.put("approveBy", nullToEmpty(displayName(str(r.get("shr")))));
                out.put("approveAt", fmtObj(r.get("shsj")));
            }
        } catch (Exception ignore) { /* 状态表缺 ⇒ 留下面兜底 */ }
        // ③ 终审人还是没有 ⇒ 用留痕里最新一条 APPROVE（老单只写了留痕的情况）
        if (String.valueOf(out.get("approveBy")).isEmpty()) {
            try {
                List<Map<String, Object>> rows = jdbc.queryForList(
                        "SELECT TOP 1 ISNULL(operator,N'') AS op, create_time AS at FROM yj_form_approval"
                                + " WHERE panel_code = ? AND form_no = ? AND action = N'APPROVE'"
                                + " AND ISNULL(operator,'') <> '' ORDER BY id DESC", panelCode, no);
                if (!rows.isEmpty()) {
                    out.put("approveBy", nullToEmpty(displayName(str(rows.get(0).get("op")))));
                    out.put("approveAt", fmtObj(rows.get(0).get("at")));
                }
            } catch (Exception ignore) { /* 取不到就留空 */ }
        }
        return out;
    }

    private static String nullToEmpty(String v) { return v == null ? "" : v; }

    /** 各种时间类型统一成 yyyy-MM-dd HH:mm（与 {@link #fmt} 同口径；null 返回空串） */
    private String fmtObj(Object v) {
        if (v == null) return "";
        if (v instanceof java.sql.Timestamp t) return fmt(t);
        if (v instanceof java.time.LocalDateTime d) return fmt(java.sql.Timestamp.valueOf(d));
        String s = String.valueOf(v);
        return s.length() >= 16 ? s.substring(0, 16) : s;
    }

    /**
     * 该单**最后一次操作的人**（2026-11-19 销售问题汇总 P14：
     *  「产品文件流程管控要跟项目查询一样，增加填写人名字」）。
     *
     * <p>取数顺序与 {@link #lastActionAt} 同源、取到就返回：</p>
     * <ol>
     *   <li>{@code yj_form_approval} 最后一条的 operator —— 提交/审批/弃审的人最准；</li>
     *   <li>退回 {@code yj_doc_status}：审核人 shr > 提交人 pending_by > 修改审批人 modify_appr_by；</li>
     *   <li>再退回单据头的 {@code asp_user2 / asp_user1}（最近修改/创建人）。</li>
     * </ol>
     *
     * <p>返回**姓名**：账号经 {@code yj_user.real_name} 解析；历史/外部账号查不到姓名时原样返回账号
     * （2026-11-20 用户口径「名字显示成姓名优先，取不到姓名时回落账号」）。</p>
     *
     * <p>⚠ 2026-11-20 实测修正：第二级原来查 {@code archived_by}，而 {@code yj_doc_status}
     * **没有这一列**（生产库列清单里只有 {@code archived} 标志和 {@code archived_at}），
     * 整条 SELECT 报 207 后被 catch 吞掉 ⇒ 这一级永远不生效、直接掉到第三级。
     * 改为查真实存在的列，避免"看着有三档、实际只有两档"。</p>
     */
    private String lastActorOf(String panelCode, String no) {
        if (panelCode == null || no == null || no.isBlank()) return "";
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT TOP 1 operator FROM yj_form_approval WHERE panel_code = ? AND form_no = ?"
                            + " AND ISNULL(operator,'') <> '' ORDER BY create_time DESC", panelCode, no);
            if (!rows.isEmpty()) {
                String name = displayName(str(rows.get(0).get("operator")));
                if (name != null) return name;
            }
        } catch (Exception ignore) { /* 留痕表缺 ⇒ 退回状态表 */ }
        try {
            List<Map<String, Object>> rs = jdbc.queryForList(
                    "SELECT shr, pending_by, modify_appr_by FROM yj_doc_status WHERE panel_code = ? AND doc_no = ?",
                    panelCode, no);
            if (!rs.isEmpty()) {
                for (String k : new String[]{"shr", "pending_by", "modify_appr_by"}) {
                    String name = displayName(str(rs.get(0).get(k)));
                    if (name != null) return name;
                }
            }
        } catch (Exception ignore) { /* 列缺失 ⇒ 下一档 */ }
        try {
            PanelRegistry.PanelDef def = registry.panel(panelCode);
            if (def != null) {
                List<Map<String, Object>> h = jdbc.queryForList(
                        "SELECT TOP 1 asp_user2, asp_user1 FROM " + def.headTable() + " WHERE [单据编号] = ?", no);
                if (!h.isEmpty()) {
                    for (String k : new String[]{"asp_user2", "asp_user1"}) {
                        String name = displayName(str(h.get(0).get(k)));
                        if (name != null) return name;
                    }
                }
            }
        } catch (Exception ignore) { /* 最后兜底也失败 ⇒ 空串 */ }
        return "";
    }

    /**
     * 该单**最后一次操作**的时间(2026-11-17 用户口径「每个都显示处理的日期」)。
     *
     * <p>取数顺序(先准后粗,取到就返回):</p>
     * <ol>
     *   <li>{@code yj_form_approval.create_time} 的 MAX —— 审批/提交/弃审每一步都留痕,
     *       是"我几点几分操作的"最准的一条;</li>
     *   <li>退回 {@code yj_doc_status}:审核时间 shsj > 归档时间 archived_at > 通用 update_at
     *       (保存/提交/审批都会刷新它)。</li>
     * </ol>
     * <p>两者都取不到(如单据刚建还没落状态行)返回空串,前端显示「—」,不编造时间。</p>
     *
     * @return "yyyy-MM-dd HH:mm" 或空串
     */
    private String lastActionAt(String panelCode, String no) {
        if (panelCode == null || no == null || no.isBlank()) return "";
        try {
            List<java.sql.Timestamp> ts = jdbc.queryForList(
                    "SELECT MAX(create_time) FROM yj_form_approval WHERE panel_code = ? AND form_no = ?",
                    java.sql.Timestamp.class, panelCode, no);
            if (!ts.isEmpty() && ts.get(0) != null) return fmt(ts.get(0));
        } catch (Exception ignore) { /* 留痕表缺列/缺表 ⇒ 退回状态表 */ }
        try {
            List<Map<String, Object>> rs = jdbc.queryForList(
                    "SELECT shsj, archived_at, update_at FROM yj_doc_status WHERE panel_code = ? AND doc_no = ?",
                    panelCode, no);
            if (!rs.isEmpty()) {
                Map<String, Object> r = rs.get(0);
                for (String k : new String[]{"shsj", "archived_at", "update_at"}) {
                    Object v = r.get(k);
                    if (v instanceof java.sql.Timestamp t) return fmt(t);
                    if (v instanceof java.time.LocalDateTime d) return fmt(java.sql.Timestamp.valueOf(d));
                }
            }
        } catch (Exception ignore) { /* 状态表取不到 ⇒ 空串 */ }
        return "";
    }

    /** 时间统一成 yyyy-MM-dd HH:mm(用户举例就是这个粒度:「2026年11月17日13:31分」) */
    private static String fmt(java.sql.Timestamp t) {
        return new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm").format(t);
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
