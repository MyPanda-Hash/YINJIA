package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 研发「项目流程管控」只读取数(2026-10-20 用户口径)。
 *
 * <p>用户原话:「我填写立项申请之后提交审批,但是我不知道我这个文件到底到哪个流程了……
 * 现在在研发管理的项目管理里面加上一个项目流程管控,可以在这个面板通过立项申请表的编号进行一个
 * 流程查询,看看这个编号对应的流程走到哪里了,哪个环节还没有审批,哪个单据审批了下一张单内容还没有开始填写」。
 *
 * <p>本类**只负责把链路各环节的原始事实取出来**(不判"走到哪一步"):环节判定与待办人推断在前端
 * 纯函数 {@code frontend/src/core/rd/flowStages.js} 里,便于单测把 12 种边界钉住
 * (草稿/待审批/已审未定级/定了级未分发/未确认责任人/未确认收到/计划未建/计划未填/计划已填未提交/
 * 计划待审批/已归档未同步/全部完成)。
 *
 * <p>关联键(2026-10-20 实测两账套确认真实数据):
 * <ul>
 *   <li>立项申请 → 实施计划: {@code rd_plan.[文档编号] = rd_approval.[单据编号]}
 *       —— 2026-10-19「责任人确认收到即自动建计划」走的就是这个键
 *       (ButtonService.ensurePlanForApproval);老单可能是 {@code = rd_approval.[文档编号]},两个都认。</li>
 *   <li>实施计划 → 项目进度查询: {@code rd_progress_detail.[说明] = rd_plan.[文档编号]}
 *       (= 立项单号),见 ButtonService.syncPlanToProgress。</li>
 *   <li>审批/归档/弃审状态: {@code yj_doc_status(panel_code, doc_no)};</li>
 *   <li>每一步动作时间与操作人: {@code yj_form_approval(panel_code, form_no, action, result, operator, create_time)}。</li>
 * </ul>
 */
@Service
public class RdProjectFlowService {

    private final JdbcTemplate jdbc;

    /** 一次最多返回多少条立项(按单号倒序);流程管控是抽查/盯单用的,不做分页 */
    private static final int MAX_ROWS = 200;

    public RdProjectFlowService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 流程查询。
     *
     * @param keyword 立项申请单号(或文档编号/机型)的片段;空 = 全部在册立项
     * @return {projects:[{…facts…}], truncated:bool}
     */
    public Map<String, Object> query(String keyword) {
        String kw = keyword == null ? "" : keyword.trim();
        List<Map<String, Object>> approvals = jdbc.queryForList(
                "SELECT TOP " + MAX_ROWS + " [单据编号] AS no, ISNULL([文档编号],N'') AS docNo,"
                        + " ISNULL([机型及应用位置],N'') AS projectName, ISNULL([客户名],N'') AS customer,"
                        + " ISNULL([申请立项人],N'') AS initiator, ISNULL([项目等级],N'') AS level,"
                        + " ISNULL([备用1],N'') AS liaison, ISNULL([备用2],N'') AS owner,"
                        + " ISNULL([备用3],N'') AS ownerAck, ISNULL([备用4],N'') AS ownerAckAt,"
                        + " ISNULL([滤芯炭棒规格或结构],N'') AS spec,"
                        + " CONVERT(varchar(19), asp_time1, 120) AS createdAt,"
                        + " CONVERT(varchar(19), asp_time2, 120) AS updatedAt,"
                        + " ISNULL(asp_user1,N'') AS createdBy"
                        // 作废/删除判活(2026-10-30 用户报障「服务器上已经把这个项目的立项申请和项目实施计划
                        // 删掉了,现在还出现在项目流程管控……已经弃审废弃删除的单据流程就不需要再追踪了」):
                        // voidDoc 只写 yj_doc_status.canceled='Y'、**不动业务表 asp_cancel**
                        // ⇒ 只按 asp_cancel 过滤的话,已作废的立项照样被当成活着,越积越多且无人工删除入口
                        //   (项目进度查询是只读面板)。两侧都排(与 QueryService 列表口径一致)。
                        + "  FROM rd_approval WHERE ISNULL(asp_cancel,'N') <> 'Y'"
                        + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_APPROVAL'"
                        + " AND s.doc_no = rd_approval.[单据编号] AND ISNULL(s.canceled,'N') = 'Y')"
                        + (kw.isEmpty() ? "" : " AND ([单据编号] LIKE ? OR ISNULL([文档编号],N'') LIKE ?"
                        + " OR ISNULL([机型及应用位置],N'') LIKE ? OR ISNULL([客户名],N'') LIKE ?)")
                        + " ORDER BY [单据编号] DESC",
                kwArr(kw, 4));
        if (approvals.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("projects", List.of());
            empty.put("truncated", false);
            return empty;
        }
        List<String> nos = new ArrayList<>();
        for (Map<String, Object> r : approvals) nos.add(str(r.get("no")));
        Set<String> planKeys = new LinkedHashSet<>(nos);   // 新口径:计划.文档编号 = 立项单号
        for (Map<String, Object> r : approvals) {
            String d = str(r.get("docNo"));
            if (!d.isEmpty()) planKeys.add(d);             // 老口径:计划.文档编号 = 立项.文档编号
        }

        Map<String, Map<String, Object>> apStatus = statusOf("RD_APPROVAL", nos);
        Map<String, List<Map<String, Object>>> plans = plansByDocNo(planKeys);
        List<String> planNos = new ArrayList<>();
        for (List<Map<String, Object>> l : plans.values()) for (Map<String, Object> p : l) planNos.add(str(p.get("no")));
        Map<String, Map<String, Object>> planStatus = statusOf("RD_PLAN", planNos);
        Map<String, List<String>> progressByDocNo = progressByDocNo(planKeys);
        Map<String, List<Map<String, Object>>> trail = trailOf(nos, planNos);
        Map<String, String> names = namesOf(approvals, apStatus, plans, planStatus);

        List<Map<String, Object>> projects = new ArrayList<>();
        for (Map<String, Object> r : approvals) {
            String no = str(r.get("no"));
            String docNo = str(r.get("docNo"));
            List<Map<String, Object>> planRows = new ArrayList<>();
            planRows.addAll(plans.getOrDefault(no, List.of()));
            if (!docNo.isEmpty() && !docNo.equals(no)) planRows.addAll(plans.getOrDefault(docNo, List.of()));

            Map<String, Object> p = new LinkedHashMap<>();
            p.put("approvalNo", no);
            p.put("approvalDocNo", docNo);
            p.put("projectName", str(r.get("projectName")));
            p.put("customer", str(r.get("customer")));
            p.put("spec", str(r.get("spec")));
            p.put("initiator", str(r.get("initiator")));
            p.put("createdBy", str(r.get("createdBy")));
            p.put("createdAt", str(r.get("createdAt")));
            p.put("updatedAt", str(r.get("updatedAt")));
            p.put("level", str(r.get("level")));
            p.put("liaison", str(r.get("liaison")));
            p.put("owner", str(r.get("owner")));
            p.put("ownerAck", str(r.get("ownerAck")));
            p.put("ownerAckAt", str(r.get("ownerAckAt")));
            p.put("approvalStatus", apStatus.getOrDefault(no, Map.of()));

            List<Map<String, Object>> planOut = new ArrayList<>();
            String progressDocNo = "";
            for (Map<String, Object> pl : planRows) {
                String planNo = str(pl.get("no"));
                Map<String, Object> plOut = new LinkedHashMap<>(pl);
                plOut.put("status", planStatus.getOrDefault(planNo, Map.of()));
                planOut.add(plOut);
                String pd = str(pl.get("docNo"));
                if (!pd.isEmpty()) progressDocNo = pd;
            }
            p.put("plans", planOut);
            // 老单据兜底(2026-10-20 用户问「旧单据会不会查不到」):
            //   实施计划的『文档编号』若是手填机型/留空,按单号就关联不上 ⇒ 这里把「项目名称相同」或
            //   「文档编号为空」的候选计划捞出来(最多 3 张),页面会提示"疑似计划 LXB-…,请把文档编号填成
            //   本立项单号"。只读提示,不改任何数据。
            if (planOut.isEmpty()) p.put("planCandidates", planCandidates(str(r.get("projectName"))));
            String progressKey = progressDocNo.isEmpty() ? no : progressDocNo;
            List<String> progRows = progressByDocNo.getOrDefault(progressKey, List.of());
            if (progRows.isEmpty() && !docNo.isEmpty()) progRows = progressByDocNo.getOrDefault(docNo, List.of());
            p.put("progressRows", progRows);
            List<Map<String, Object>> tr = new ArrayList<>();
            tr.addAll(trail.getOrDefault("RD_APPROVAL|" + no, List.of()));
            for (Map<String, Object> pl : planRows) {
                tr.addAll(trail.getOrDefault("RD_PLAN|" + str(pl.get("no")), List.of()));
            }
            p.put("trail", tr);
            projects.add(p);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("projects", projects);
        out.put("truncated", approvals.size() >= MAX_ROWS);
        out.put("names", names);
        return out;
    }

    // ─────────────────────────── 取数细节 ───────────────────────────

    private Object[] kwArr(String kw, int n) {
        if (kw.isEmpty()) return new Object[0];
        Object[] a = new Object[n];
        for (int i = 0; i < n; i++) a[i] = "%" + kw + "%";
        return a;
    }

    /** 单据状态行(yj_doc_status):doc_no → {pending, pendingBy, pendingAt, shr, shsj, archived, archivedAt, canceled, modifyState} */
    private Map<String, Map<String, Object>> statusOf(String panelCode, Collection<String> nos) {
        Map<String, Map<String, Object>> out = new LinkedHashMap<>();
        if (nos.isEmpty()) return out;
        List<Object> args = new ArrayList<>();
        args.add(panelCode);
        args.addAll(nos);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT doc_no, ISNULL(pending,'N') AS pending, ISNULL(pending_by,N'') AS pendingBy,"
                        + " CONVERT(varchar(19), pending_at, 120) AS pendingAt, ISNULL(shr,N'') AS shr,"
                        + " CONVERT(varchar(19), shsj, 120) AS shsj, ISNULL(archived,'N') AS archived,"
                        + " CONVERT(varchar(19), archived_at, 120) AS archivedAt, ISNULL(canceled,'N') AS canceled,"
                        + " ISNULL(modify_state,N'') AS modifyState, ISNULL(stopped,N'') AS stopped"
                        + "  FROM yj_doc_status WHERE panel_code = ? AND doc_no IN (" + marks(nos.size()) + ")",
                args.toArray());
        for (Map<String, Object> r : rows) out.put(str(r.get("doc_no")), r);
        return out;
    }

    /** 实施计划:文档编号 → [该编号下全部未作废计划(含阶段填写情况)] */
    private Map<String, List<Map<String, Object>>> plansByDocNo(Collection<String> docNos) {
        Map<String, List<Map<String, Object>>> out = new LinkedHashMap<>();
        if (docNos.isEmpty()) return out;
        StringBuilder stageCols = new StringBuilder();
        for (int i = 1; i <= 10; i++) {
            stageCols.append(", ISNULL([阶段").append(i).append("_计划内容],N'') AS s").append(i).append('p');
            stageCols.append(", ISNULL(CONVERT(varchar(19),[阶段").append(i).append("_实际完成],120),N'') AS s").append(i).append('d');
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT [单据编号] AS no, ISNULL([文档编号],N'') AS docNo, ISNULL([项目名称],N'') AS projectName,"
                        + " ISNULL([项目定级],N'') AS level, ISNULL([负责人],N'') AS owner,"
                        + " CONVERT(varchar(19), asp_time1, 120) AS createdAt,"
                        + " CONVERT(varchar(19), asp_time2, 120) AS updatedAt,"
                        + " ISNULL(asp_user1,N'') AS createdBy" + stageCols
                        + "  FROM rd_plan WHERE ISNULL(asp_cancel,'N') <> 'Y'"
                        // 同上(2026-10-30):已作废的实施计划不再参与流程追踪与"疑似关联"提示
                        + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_PLAN'"
                        + " AND s.doc_no = rd_plan.[单据编号] AND ISNULL(s.canceled,'N') = 'Y')"
                        + " AND [文档编号] IN (" + marks(docNos.size()) + ") ORDER BY id",
                docNos.toArray());
        for (Map<String, Object> r : rows) {
            int planned = 0, done = 0;
            for (int i = 1; i <= 10; i++) {
                Object content = r.remove("s" + i + "p");
                Object actual = r.remove("s" + i + "d");
                if (content != null && !String.valueOf(content).isBlank()) planned++;
                if (actual != null && !String.valueOf(actual).isBlank()) done++;
            }
            r.put("plannedStages", planned);
            r.put("doneStages", done);
            out.computeIfAbsent(str(r.get("docNo")), k -> new ArrayList<>()).add(r);
        }
        return out;
    }

    /** 项目进度查询是否已有该项目的行:文档编号/立项单号 → [进度单号 + 状态] */
    private Map<String, List<String>> progressByDocNo(Collection<String> docNos) {
        Map<String, List<String>> out = new LinkedHashMap<>();
        if (docNos.isEmpty()) return out;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT d.[单据编号] AS no, ISNULL(d.[说明],N'') AS docNo, ISNULL(d.[状态],N'') AS status"
                        + "  FROM rd_progress_detail d"
                        + "  JOIN rd_progress p ON p.[单据编号] = d.[单据编号] AND ISNULL(p.asp_cancel,'N') <> 'Y'"
                        // 已作废的进度单不算"已进入进度查询"(2026-10-30)。
                        // ⚠ 用 NOT EXISTS 而不是 JOIN yj_doc_status:进度单可能根本没状态行,
                        //   INNER JOIN 会把"正常但没状态行"的单一起丢掉(实测:该表只有被操作过的单才有行)。
                        + "  WHERE ISNULL(d.asp_cancel,'N') <> 'Y'"
                        + "   AND NOT EXISTS (SELECT 1 FROM yj_doc_status ps WHERE ps.panel_code = N'RD_PROGRESS'"
                        + "     AND ps.doc_no = d.[单据编号] AND ISNULL(ps.canceled,'N') = 'Y')"
                        + "   AND d.[说明] IN (" + marks(docNos.size()) + ")",
                docNos.toArray());
        for (Map<String, Object> r : rows) {
            out.computeIfAbsent(str(r.get("docNo")), k -> new ArrayList<>())
                    .add(str(r.get("no")) + " · " + str(r.get("status")));
        }
        return out;
    }

    /** 审批留痕:panel|doc → [{action,result,operator,at,opinion}](按时间正序) */
    private Map<String, List<Map<String, Object>>> trailOf(Collection<String> apNos, Collection<String> planNos) {
        Map<String, List<Map<String, Object>>> out = new LinkedHashMap<>();
        if (!apNos.isEmpty()) collectTrail("RD_APPROVAL", apNos, out);
        if (!planNos.isEmpty()) collectTrail("RD_PLAN", planNos, out);
        return out;
    }

    private void collectTrail(String panel, Collection<String> nos, Map<String, List<Map<String, Object>>> out) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT form_no, ISNULL(action,N'') AS action, ISNULL(result,N'') AS result,"
                        + " ISNULL(operator,N'') AS operator, ISNULL(opinion,N'') AS opinion,"
                        + " CONVERT(varchar(19), create_time, 120) AS at"
                        + "  FROM yj_form_approval WHERE panel_code = ? AND form_no IN (" + marks(nos.size()) + ")"
                        + " ORDER BY id",
                appendFirst(panel, nos));
        for (Map<String, Object> r : rows) {
            r.put("panel", panel); // 前端按 panel 区分 RD_APPROVAL / RD_PLAN 的同名动作(SUBMIT/APPROVE)
            out.computeIfAbsent(panel + "|" + str(r.get("form_no")), k -> new ArrayList<>()).add(r);
        }
    }

    /**
     * 疑似关联断链的实施计划(老单据兜底):『文档编号』为空,或项目名称与立项的「机型及应用位置」相同。
     * 只用于页面提示"单子其实存在,只是没按单号关联",不改数据。
     */
    private List<Map<String, Object>> planCandidates(String projectName) {
        List<Map<String, Object>> out = new ArrayList<>();
        // 已作废的计划不当候选(2026-10-30):否则作废掉的单还会以"疑似关联"提示挂在别人名下
        final String alive = " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = N'RD_PLAN'"
                + " AND s.doc_no = rd_plan.[单据编号] AND ISNULL(s.canceled,'N') = 'Y')";
        if (projectName.isEmpty()) {
            out.addAll(jdbc.queryForList(
                    "SELECT TOP 3 [单据编号] AS no, ISNULL([文档编号],N'') AS docNo, ISNULL([项目名称],N'') AS projectName"
                            + "  FROM rd_plan WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL([文档编号],N'') = N''"
                            + alive
                            + " ORDER BY id DESC"));
            return out;
        }
        out.addAll(jdbc.queryForList(
                "SELECT TOP 3 [单据编号] AS no, ISNULL([文档编号],N'') AS docNo, ISNULL([项目名称],N'') AS projectName"
                        + "  FROM rd_plan WHERE ISNULL(asp_cancel,'N') <> 'Y'"
                        + "   AND ([项目名称] = ? OR ISNULL([文档编号],N'') = N'')" + alive + " ORDER BY id DESC",
                projectName));
        return out;
    }

    /** 账号 → 姓名(前端拼「姓名（账号）」;含全部出现的账号) */    private Map<String, String> namesOf(List<Map<String, Object>> approvals,
                                        Map<String, Map<String, Object>> apStatus,
                                        Map<String, List<Map<String, Object>>> plans,
                                        Map<String, Map<String, Object>> planStatus) {
        Set<String> users = new LinkedHashSet<>();
        for (Map<String, Object> r : approvals) {
            for (String k : new String[]{"liaison", "owner", "ownerAck", "createdBy"}) addIfNotBlank(users, r.get(k));
        }
        for (Map<String, Object> s : apStatus.values()) addIfNotBlank(users, s.get("pendingBy"));
        for (Map<String, Object> s : apStatus.values()) addIfNotBlank(users, s.get("shr"));
        for (List<Map<String, Object>> l : plans.values()) {
            for (Map<String, Object> p : l) addIfNotBlank(users, p.get("owner"));
        }
        for (Map<String, Object> s : planStatus.values()) {
            addIfNotBlank(users, s.get("pendingBy"));
            addIfNotBlank(users, s.get("shr"));
        }
        Map<String, String> out = new LinkedHashMap<>();
        if (users.isEmpty()) return out;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT username, ISNULL(real_name,N'') AS realName FROM yj_user WHERE username IN ("
                        + marks(users.size()) + ")", users.toArray());
        for (Map<String, Object> r : rows) out.put(str(r.get("username")), str(r.get("realName")));
        return out;
    }

    private static void addIfNotBlank(Set<String> set, Object v) {
        String s = str(v);
        if (!s.isEmpty()) set.add(s);
    }

    private static Object[] appendFirst(String first, Collection<String> rest) {
        List<Object> a = new ArrayList<>();
        a.add(first);
        a.addAll(rest);
        return a.toArray();
    }

    private static String marks(int n) {
        return String.join(",", java.util.Collections.nCopies(n, "?"));
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
