package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工序检验单门禁的**执行层**(2026-10-16):把 {@link WoInspGate} 的纯判定接到「建单前」这件事上 ——
 * 按强度档位决定放行 / 预警放行 / 拦截,并负责**留痕**与**管理员强制开单**。
 *
 * <p><b>为什么单独一层</b>:首件检验单与制程检验单两个控制器都要「过闸 + 留痕 + 强制放行」这一套,
 * 写在控制器里就是两份平行实现(《代码规范》D 禁止),而控制器本身该零业务(A 分层边界)。
 * 判据仍在 {@link WoInspGate}(纯静态、可被探针直接调用),本类只做动作编排。</p>
 *
 * <p><b>留痕</b>:写 {@code yj_usage_log}(与 {@code PxController} 的面板动作留痕同一张表、同一个
 * {@link UsageLogService}),两条动作名 —— ① 预警放行 ② 强制开单(附原因片段)。</p>
 *
 * <p><b>强制开单</b>:拦截行允许越闸,但必须 ① 填原因 ② 具备该面板的「强制开单」权限词(管理员恒过,
 * 与 {@link PanelPermissionService#hasAnyPerm} 同源 —— 将来要放给品质主管,只需在权限矩阵里勾一个词)。
 * 行业依据:金蝶/畅捷通都保留「下推补生成」这类人工通道,**留手工通道 = 特殊场景不必改库**。</p>
 *
 * <p><b>2026-10-20</b>:首件检验单退出本门禁({@link WoInspGate#gated}) ⇒ 本类的
 * {@link #enforce}/{@link #decorate} 对它直接放行/标「可开单」,不再判成型报工。</p>
 */
@Service
public class WoInspGateGuard {

    /** 留痕动作名(预警放行) */
    public static final String ACTION_WARN = "检验单门禁预警放行";
    /** 留痕动作名(强制开单) */
    public static final String ACTION_FORCE = "检验单门禁强制开单";
    /** 强制开单所需的权限词(权限矩阵里勾;管理员恒过) */
    public static final String PERM_FORCE = "强制开单";

    private final JdbcTemplate jdbc;
    private final UsageLogService usage;
    private final PanelPermissionService perm;

    public WoInspGateGuard(JdbcTemplate jdbc, UsageLogService usage, PanelPermissionService perm) {
        this.jdbc = jdbc;
        this.usage = usage;
        this.perm = perm;
    }

    /**
     * 过闸结论。
     *
     * @param allowed 是否允许建单
     * @param code    不允许时的 HTTP 语义码(422 门禁拦截 / 400 缺原因 / 403 无强制权限)
     * @param error   不允许时的给前端话术
     * @param status  判定明细(放行时调用方可能还要记账,如预警标记);通用判定(见 {@link #enforceVerdict})为 null
     */
    public record Decision(boolean allowed, int code, String error, WoInspGate.Status status) {}

    /**
     * 通用前置结论(2026-11-12):不同检验单的前置工序不同(首件/制程 = 成型已报工;
     * 出货检验表观 = 已进入组装/装箱),但「拦截话术 + 预警留痕 + 管理员强制开单」这一套共用。
     *
     * @param allowed 是否放行
     * @param warn    预警放行(放行但写留痕)
     * @param reason  不放行时的话术
     */
    public record Verdict(boolean allowed, boolean warn, String reason) {}

    /**
     * **建单前统一过闸**。
     *
     * @param body 建单请求体:可选 {@code 强制开单}=true 与 {@code 强制开单原因}(管理员越闸用)
     * @param ip   调用方 IP(留痕用;传空串也能记)
     */
    public Decision enforce(String panelCode, String wo, Integer xc, Map<String, Object> body, String ip) {
        // 2026-10-20:首件检验单不受本门禁约束(用户口径「只关联生产工单即可,不需要成型报工完成」)
        //   ⇒ 直接放行。判据名单在 WoInspGate.UNGATED_PANELS 一处,调用方形状保持不变。
        if (!WoInspGate.gated(panelCode)) return new Decision(true, 0, "", WoInspGate.pass());
        WoInspGate.Status st = WoInspGate.check(jdbc, wo, xc);
        if (st.allowed() && !st.warn()) return new Decision(true, 0, "", st);
        return decide(panelCode, st.warn(), st.reason(), docNo(wo, xc), body, ip, st);
    }

    /**
     * **通用过闸**(2026-11-12 新增):判定由调用方给(如出货检验表观 = {@code AsmInspEntry}),
     * 留痕 / 强制开单 / 权限校验这一套与 {@link #enforce} 完全同一份实现。
     */
    public Decision enforceVerdict(String panelCode, Verdict v, String docNo, Map<String, Object> body, String ip) {
        if (v == null || v.allowed() && !v.warn()) return new Decision(true, 0, "", null);
        return decide(panelCode, v.warn(), v.reason(), docNo, body, ip, null);
    }

    /** 拦截 / 预警放行 / 强制开单的**唯一**动作编排(两处调用共用) */
    private Decision decide(String panelCode, boolean warn, String reason, String docNo,
                            Map<String, Object> body, String ip, WoInspGate.Status st) {
        // ① 预警放行:能开单,但要留痕(现场"知道自己在绕过什么",事后可查)
        if (warn) {
            usage.recordAction(currentUser(), usage.realNameOf(currentUser(), currentUser()),
                    panelCode, ACTION_WARN, docNo, blankToNull(ip));
            return new Decision(true, 0, "", st);
        }
        // ② 拦截:只有「填了原因 + 有强制权限」才允许越闸
        if (!truthy(body == null ? null : body.get("强制开单"))) {
            return new Decision(false, 422, reason, st);
        }
        String why = str(body == null ? null : body.get("强制开单原因"));
        if (why.isEmpty()) return new Decision(false, 400, "强制开单必须填写原因", st);
        if (!perm.hasAnyPerm(panelCode, PERM_FORCE)) {
            return new Decision(false, 403, "仅具备「" + PERM_FORCE + "」权限的用户可强制开单", st);
        }
        usage.recordAction(currentUser(), usage.realNameOf(currentUser(), currentUser()),
                panelCode, ACTION_FORCE + ":" + clip(why, 40), docNo, blankToNull(ip));
        return new Decision(true, 0, "", st);
    }

    /**
     * 把门禁结论落到弹窗列表的每一行(两个控制器共用;字段名即前端读取的键)。
     * <p>⚠ 入参 rows 必须带 {@code 行id/工单号/工单行号/批次号/工艺路线/排产数量}(两个控制器的取数已如此)。
     *
     * <p>2026-10-20:不受门禁的面板(首件检验单)不再逐行判,统一给「可开单 = true」等中性值 ——
     * 共享的选单弹窗照旧读这几个键,只是永远不为灰。准入过滤(未完工/未被占用)在各自控制器的取数里。
     */
    public void decorate(String panelCode, List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) return;
        if (!WoInspGate.gated(panelCode)) {
            for (Map<String, Object> r : rows) {
                r.put("成型完工量", 0);
                r.put("成型计划量", 0);
                r.put("可开单", true);
                r.put("预警放行", false);
                r.put("免门禁", false);
                r.put("存量放行", false);
                r.put("门禁档位", "");
                r.put("不能开单原因", "");
            }
            return;
        }
        Map<String, WoInspGate.Status> gate = WoInspGate.checkPage(jdbc, rows);
        for (Map<String, Object> r : rows) {
            WoInspGate.Status st = gate.get(WoInspGate.key(str(r.get("工单号")), intOf(r.get("工单行号"))));
            r.put("成型完工量", st == null ? 0 : st.moldDone());
            r.put("成型计划量", st == null ? 0 : st.moldPlan());
            r.put("可开单", st == null || st.allowed());
            r.put("预警放行", st != null && st.warn());
            r.put("免门禁", st != null && st.exempt());
            r.put("存量放行", st != null && st.legacy());
            r.put("门禁档位", st == null || st.mode() == null ? "" : st.mode().name());
            r.put("不能开单原因", st == null ? "" : st.reason());
        }
    }

    /** 账位/档位信息(前端顶部提示用):门禁档位 + 该用户能否强制开单 + 本面板是否受门禁 */
    public Map<String, Object> meta(String panelCode) {
        return meta(panelCode, WoInspGate.gated(panelCode));
    }

    /**
     * 同上,但「本面板受不受门禁」由调用方给(2026-11-12:出货检验表观用的是「进入组装/装箱」判定,
     * 不是成型报工门禁 —— 它仍需要共用「可强制开单」这个能力位与留痕)。
     */
    public Map<String, Object> meta(String panelCode, boolean gated) {
        Map<String, Object> out = new LinkedHashMap<>();
        WoInspGate.Policy pol = WoInspGate.policy(jdbc);
        out.put("门禁生效", gated);
        out.put("门禁档位", gated ? pol.mode().name() : "");
        out.put("存量拦截", gated && pol.legacyBlock());
        out.put("可强制开单", perm.hasAnyPerm(panelCode, PERM_FORCE));
        return out;
    }

    // ────────────────────────────── 工具 ──────────────────────────────

    private static String docNo(String wo, Integer xc) {
        return str(wo) + "#" + (xc == null ? 0 : xc);
    }

    private static boolean truthy(Object o) {
        if (o == null) return false;
        if (o instanceof Boolean b) return b;
        String s = String.valueOf(o).trim();
        return "true".equalsIgnoreCase(s) || "Y".equalsIgnoreCase(s) || "1".equals(s) || "是".equals(s);
    }

    private static String clip(String s, int max) {
        String t = s == null ? "" : s.trim();
        return t.length() <= max ? t : t.substring(0, max);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static Integer intOf(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        try {
            return (int) Double.parseDouble(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String currentUser() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return auth == null || auth.getName() == null || auth.getName().isBlank() ? "system" : auth.getName();
    }
}
