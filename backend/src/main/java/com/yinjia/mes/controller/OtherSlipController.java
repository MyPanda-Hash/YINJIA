package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 手机扫码 · 单据纸面报表取数(2026-11-16)。
 *
 * <h3>用户口径(原话)</h3>
 * 「其他领料,其他退料和生产退料。都要可以打印报表。(这3个都是在提交的时候打印的,可以补打印。
 *  其他领料和其他退料要有对应关系的二维码,方便手机扫码后补打印,或查询补打印)。
 *  打印格式和生产领料一样,只是名称不同」
 *
 * <h3>为什么单独一个接口(而不是前端翻面板列表找单据)</h3>
 * 补打印要按**单号**取回那张单的明细,而通用列表接口({@code /px/queryFormDataList})
 * 对单据面板只支持按日期倒序翻页 —— 用 {@code condition}/{@code keyword} 传单号实测都查不到
 * (2026-11-16 实测:传「单据编号」与 keyword 都返回 totalSize=0)。
 * 与其在前端翻页里捞一张单,不如给一个**按单号**的窄接口:一条头 + 一批行,别的都不做。
 *
 * <h3>返回的行形状 = 打印代理要的键</h3>
 * 代理 {@code tools/printing/print-agent.ps1} 画的纸面是「生产领料单」那套固定版式,
 * 逐行读的是 {@code 材料名称 / 规格 / 单位 / 请领数量 / 实发数量 / 备注}
 * (见该脚本 $heads 与 $vals)。故这里**直接按这套键返回**,前端不用再翻译一遍,
 * 三种报表(其他领料/其他退料/生产退料)因此可以共用同一份版式与同一个取数接口。
 *
 * <p>没有工单 ⇒ {@code 请领数量} 一律留空,数量进 {@code 实发数量}
 * (纸面「订单号」列也是空的 —— 这三张单本来就不挂工单,写假单号比留空更糟)。
 * {@code 备注} 放「批号 / 仓库」,现场凭这张纸核对货位靠的就是它俩。
 */
@RestController
@RequestMapping("/api/px/slip")
public class OtherSlipController {

    /** 支持出纸面的面板(与「打印格式和生产领料一样」的三张单同源) */
    private static final Set<String> PANELS = Set.of("OTHER_OUT", "MATERIAL_RET");

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;

    public OtherSlipController(JdbcTemplate jdbc, PanelPermissionService perm) {
        this.jdbc = jdbc;
        this.perm = perm;
    }

    /**
     * 取一张单据的纸面报表数据(头 + 行)。
     *
     * @param body {面板: 'OTHER_OUT' | 'MATERIAL_RET', 单据编号}
     * @return {面板, 单据编号, 单据日期, 部门, 明细:[{材料名称,规格,单位,请领数量,实发数量,备注}]}
     */
    @PostMapping("/rows")
    public ApiResult<Map<String, Object>> rows(@RequestBody Map<String, Object> body) {
        String panel = str(body.get("面板"));
        String no = str(body.get("单据编号"));
        if (!PANELS.contains(panel)) {
            throw new IllegalArgumentException("不支持出纸面的单据面板:" + panel);
        }
        if (no.isEmpty()) throw new IllegalArgumentException("请提供单据编号(扫码或手工输入)");
        // 读这张单的明细 = 读该面板的数据 ⇒ 与列表页同一道权限闸门
        perm.requirePanelView(panel);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("面板", panel);
        out.put("单据编号", no);

        if ("OTHER_OUT".equals(panel)) {
            fillOtherOut(out, no);
        } else {
            fillMaterialRet(out, no);
        }

        List<Map<String, Object>> rows = listOf(out.get("明细"));
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("单据 " + no + " 没有明细行(单号写错或单据已删除)");
        }
        return ApiResult.ok(out);
    }

    /** 其他出库单(其他领料):头 = bd_other_out,行 = bl_other_out */
    private void fillOtherOut(Map<String, Object> out, String no) {
        List<Map<String, Object>> head = jdbc.queryForList(
                "SELECT TOP 1 单据日期, 部门, 经手人 FROM dbo.bd_other_out"
                        + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (head.isEmpty()) throw new IllegalArgumentException("没有找到其他出库单 " + no);
        Map<String, Object> h = head.get(0);
        out.put("单据日期", str(h.get("单据日期")));
        // 纸面「领料部门」:部门优先,部门没填就退到经手人(现场至少看得出是谁领的)
        String dept = str(h.get("部门"));
        out.put("部门", dept.isEmpty() ? str(h.get("经手人")) : dept);

        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT 存货编码, 存货名称, 规格型号, 计量单位, 数量, 批号, 仓库"
                        + " FROM dbo.bl_other_out WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY id", no);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> l : lines) {
            rows.add(row(str(l.get("存货名称")), str(l.get("规格型号")), str(l.get("计量单位")),
                    l.get("数量"), str(l.get("批号")), str(l.get("仓库")), str(l.get("存货编码"))));
        }
        out.put("明细", rows);
    }

    /** 生产退料单(其他退料 / 生产退料):头 = bd_material_ret,行 = bl_material_ret */
    private void fillMaterialRet(Map<String, Object> out, String no) {
        List<Map<String, Object>> head = jdbc.queryForList(
                "SELECT TOP 1 单据日期, 领用人, 加工单号 FROM dbo.bd_material_ret"
                        + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (head.isEmpty()) throw new IllegalArgumentException("没有找到生产退料单 " + no);
        Map<String, Object> h = head.get(0);
        out.put("单据日期", str(h.get("单据日期")));
        out.put("部门", str(h.get("领用人")));
        // 生产退料单可能带工单号(手机扫码生产退料那条链路会写);有就带出去让纸面能对上工单
        out.put("工单号", str(h.get("加工单号")));

        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT 材料编码, 材料名称, 规格型号, 计量单位, 数量, 批号, 仓库"
                        + " FROM dbo.bl_material_ret WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY id", no);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> l : lines) {
            rows.add(row(str(l.get("材料名称")), str(l.get("规格型号")), str(l.get("计量单位")),
                    l.get("数量"), str(l.get("批号")), str(l.get("仓库")), str(l.get("材料编码"))));
        }
        out.put("明细", rows);
    }

    /** 一行 → 代理要的键(材料名称/规格/单位/请领数量/实发数量/备注) */
    private static Map<String, Object> row(String name, String spec, String uom, Object qty,
                                           String lot, String wh, String code) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("材料名称", name.isEmpty() ? code : name);
        r.put("规格", spec);
        r.put("单位", uom);
        // 这三张单不挂工单 ⇒ 没有"请领数量",数量全部落「实发数量」
        r.put("请领数量", 0);
        r.put("实发数量", qty == null ? 0 : qty);
        // 备注 = 批号 / 仓库(现场照这张纸核对货位)
        String note = lot;
        if (!wh.isEmpty()) note = note.isEmpty() ? wh : note + " / " + wh;
        r.put("备注", note);
        return r;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> listOf(Object o) {
        return o instanceof List<?> l ? (List<Map<String, Object>>) l : List.of();
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
