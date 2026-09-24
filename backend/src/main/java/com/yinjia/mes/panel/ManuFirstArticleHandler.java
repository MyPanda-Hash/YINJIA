package com.yinjia.mes.panel;

import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.MessageService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 首件完成通知(生产部需求纪要 三·首件通知,2026-09-22)。
 *
 * <p>痛点:生产出第一批时没人通知品质部,品质自己去取样才发现已经生产完了。
 * 落地:MANU_ORDER「更多→首件完成通知」→ 置 头.首件完成='是'/首件完成时间/首件通知人,
 * 并站内消息提醒品质(收件人=能看品质检验面板的角色用户 ∪ 管理员,排除操作者),品质凭消息取样测试。
 *
 * <p>幂等语义:重复点击=更新时间再次提醒(首件状态本就一次性,不做撤销;误点可改头字段)。
 */
@Component
public class ManuFirstArticleHandler implements PanelActionHandler {

    private final ButtonService buttonService;
    private final MessageService message;
    private final JdbcTemplate jdbc;

    public ManuFirstArticleHandler(ButtonService buttonService, MessageService message, JdbcTemplate jdbc) {
        this.buttonService = buttonService;
        this.message = message;
        this.jdbc = jdbc;
    }

    @Override
    public boolean supports(String panelCode, String action) {
        return "MANU_ORDER".equals(panelCode) && "首件完成通知".equals(action);
    }

    @Override
    @Transactional
    public Map<String, Object> handle(PanelActionContext context) {
        Object noObj = context.formData() == null ? null : context.formData().get("编号");
        if (noObj == null || String.valueOf(noObj).isBlank()) throw new IllegalArgumentException("缺少表单编号");
        String no = String.valueOf(noObj);
        String user = context.userName();

        Map<String, Object> st = buttonService.docStatus("MANU_ORDER", no);
        String status = String.valueOf(st.get("status"));
        if ("已作废".equals(status)) throw new IllegalStateException("已作废单据不可操作");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT h.[批号], ISNULL(h.[生产线],N'') AS 生产线, ISNULL(h.[混料批次号],N'') AS 混料批次号,"
                        + " (SELECT TOP 1 l.[产品编码] FROM bl_manu_order l WHERE l.[合同号]=h.[合同号]"
                        + "   AND ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY l.[id]) AS 产品编码,"
                        + " (SELECT TOP 1 l.[产品名称] FROM bl_manu_order l WHERE l.[合同号]=h.[合同号]"
                        + "   AND ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY l.[id]) AS 品名,"
                        + " (SELECT TOP 1 l.[排产数量] FROM bl_manu_order l WHERE l.[合同号]=h.[合同号]"
                        + "   AND ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY l.[id]) AS 排产数量"
                        + " FROM bd_manu_order h WHERE h.[合同号] = ? AND ISNULL(h.asp_cancel,'N') <> 'Y'", no);
        if (rows.isEmpty()) throw new IllegalStateException("生产加工单不存在:" + no);
        Map<String, Object> mo = rows.get(0);

        jdbc.update("UPDATE bd_manu_order SET [首件完成]=N'Y', [首件完成时间]=SYSDATETIME(), [首件通知人]=?,"
                        + " asp_user2=?, asp_time2=SYSDATETIME() WHERE [合同号] = ?",
                user, user, no);

        // 品质收件人:能看 来料/品质检验 面板的角色用户 ∪ 管理员(排除操作者)
        List<String> targets = new ArrayList<>(message.admins());
        try {
            targets.addAll(jdbc.queryForList(
                    "SELECT DISTINCT u.username FROM yj_user u JOIN yj_role_panel rp ON rp.role_id = u.role_id"
                            + " WHERE rp.panel_code IN ('QC_INSP','WO_REPORT') AND rp.perms LIKE '%view%'", String.class));
        } catch (Exception ignore) { /* 解析失败退回管理员 */ }
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("产品", mo.get("产品编码"));
        params.put("品名", mo.get("品名"));
        params.put("碳棒批次号", mo.get("批号"));
        params.put("混料批次号", mo.get("混料批次号"));
        params.put("生产线", mo.get("生产线"));
        params.put("排产数量", mo.get("排产数量"));
        params.put("提示", "生产首件已完成,请安排取样测试");
        int n = message.send(targets, "FIRST_ARTICLE_DONE", "MANU_ORDER", no, params, user);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", no);
        out.put("首件完成", "是");
        out.put("通知人数", n);
        return out;
    }
}
