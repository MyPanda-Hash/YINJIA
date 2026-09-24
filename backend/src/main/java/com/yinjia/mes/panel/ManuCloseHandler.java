package com.yinjia.mes.panel;

import com.yinjia.mes.service.ButtonService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产加工单结案(参考库 plang_pc.ja 口径,盘点文档 §4.5 缺口②)。
 *
 * <p>参考库标准(§3.1.5):结案 ja='T'/'Y' 后工单退出需求统计(View_od_cost1/2 取 ja IN('T','Y'))。
 * 新系统落点:bd_manu_order.结案 列(迁移已建)+ v_manu_schedule 排产看板"结案"列(已有);
 * 结案守卫:仅已审核可结案(草稿/审批中/已作废/已中止均拒);已结案工单不可再拆单(ManuSplitHandler 同步守卫)。
 * 结案为人工拍板(参考库同为人工 ja),不做数量强制校验;可「取消结案」回退。
 */
@Component
public class ManuCloseHandler implements PanelActionHandler {

    private final ButtonService buttonService;
    private final JdbcTemplate jdbc;

    public ManuCloseHandler(ButtonService buttonService, JdbcTemplate jdbc) {
        this.buttonService = buttonService;
        this.jdbc = jdbc;
    }

    @Override
    public boolean supports(String panelCode, String action) {
        return "MANU_ORDER".equals(panelCode) && ("结案".equals(action) || "取消结案".equals(action));
    }

    @Override
    @Transactional
    public Map<String, Object> handle(PanelActionContext context) {
        Object noObj = context.formData() == null ? null : context.formData().get("编号");
        if (noObj == null || String.valueOf(noObj).isBlank()) throw new IllegalArgumentException("缺少表单编号");
        String no = String.valueOf(noObj);
        boolean close = "结案".equals(context.action());

        Map<String, Object> st = buttonService.docStatus("MANU_ORDER", no);
        String status = String.valueOf(st.get("status"));
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT ISNULL(结案,'N') AS ja FROM bd_manu_order WHERE 合同号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (rows.isEmpty()) throw new IllegalStateException("生产加工单不存在:" + no);
        boolean closed = "Y".equals(String.valueOf(rows.get(0).get("ja")));

        if (close) {
            if ("已作废".equals(status)) throw new IllegalStateException("已作废单据不可结案");
            if ("已中止".equals(status)) throw new IllegalStateException("已中止单据不可结案,请先恢复");
            if (!"已审核".equals(status)) throw new IllegalStateException("仅已审核单据可结案,当前状态:" + status);
            if (closed) throw new IllegalStateException("单据已结案");
            // 结案留痕:结案人/结案时间(旧系统 ProSchedList 列表列;取消结案时清空)
            jdbc.update("UPDATE bd_manu_order SET [结案] = 'Y', [结案人] = ?, [结案时间] = SYSDATETIME(),"
                            + " asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE [合同号] = ?",
                    context.userName(), context.userName(), no);
        } else {
            if (!closed) throw new IllegalStateException("单据未结案,无需取消");
            // 取消结案=回退到已审核(不锁死):清 结案/结案人/结案时间
            jdbc.update("UPDATE bd_manu_order SET [结案] = NULL, [结案人] = NULL, [结案时间] = NULL,"
                            + " asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE [合同号] = ?",
                    context.userName(), no);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", no);
        out.put("单据状态", close ? "已结案" : "已审核");
        return out;
    }
}
