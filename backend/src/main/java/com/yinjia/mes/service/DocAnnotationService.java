package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 单据纸面文字标注(标注笔 / 橡皮擦) —— yj_doc_annotation 的读写。
 *
 * 【口径】一条标注 = 某个字段原文里的一段字符区间 [startPos, endPos)(0 基,左闭右开),
 *   带颜色(#RRGGBB)与是否加粗。同一字段可多段共存;**写入时先软删相交的旧段**
 *   (用户口径"标注过的字再标注就是覆盖"),因此库内同字段永不重叠,渲染侧再兜一层。
 *   fieldKey 存的是 <b>yj_field.label</b>(前端行模型是 { [label]: value },配置与接口一律用 label)。
 *
 * 【权限】读 = 该面板查看权;写 = 该面板「保存」按钮权(与编辑单据同一道门)。
 *
 * 【为什么只读态/打印才看得见】可编辑态的值在 &lt;input&gt; 里,HTML 无法只给其中几个字上色;
 *   标注是纸面批注层,故只在只读纸面与打印模板上呈现(与用户口径"打印出对应的颜色"一致)。
 */
@Service
public class DocAnnotationService {

    /** #RRGGBB(与前端 8 档色盘同格式) */
    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final int MAX_DOC_NO = 120;
    private static final int MAX_FIELD_KEY = 120;

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perms;

    public DocAnnotationService(JdbcTemplate jdbc, PanelPermissionService perms) {
        this.jdbc = jdbc;
        this.perms = perms;
    }

    /** 列表:该单据的全部有效标注(按字段、位置排序) */
    public List<Map<String, Object>> list(String panelCode, String docNo) {
        perms.requirePanelView(panelCode);
        return query(panelCode, docNo);
    }

    /**
     * 新增一段标注(相交旧段先软删 ⇒ 后写覆盖先写)。
     * @return 该单据最新的标注列表(前端直接替换本地状态)
     */
    public List<Map<String, Object>> save(String panelCode, String docNo, String fieldKey,
                                          int start, int end, String color, boolean bold, String user) {
        perms.requireButton(panelCode, "保存");
        String fk = require(fieldKey, "字段", MAX_FIELD_KEY);
        String dn = require(docNo, "单据编号", MAX_DOC_NO);
        String col = color == null ? "" : color.trim();
        if (!COLOR.matcher(col).matches()) throw new IllegalArgumentException("颜色格式应为 #RRGGBB");
        if (start < 0 || end <= start) throw new IllegalArgumentException("标注范围不合法");
        jdbc.update("UPDATE yj_doc_annotation SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                        + " WHERE panel_code=? AND doc_no=? AND field_key=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + "   AND start_pos < ? AND end_pos > ?",
                user, panelCode, dn, fk, end, start);
        jdbc.update("INSERT INTO yj_doc_annotation (panel_code, doc_no, field_key, start_pos, end_pos, color, bold, asp_user1)"
                        + " VALUES (?,?,?,?,?,?,?,?)",
                panelCode, dn, fk, start, end, col, bold ? 1 : 0, user);
        return query(panelCode, dn);
    }

    /**
     * 橡皮擦:给了 [start,end) 只擦与之相交的段;不给范围则清空该字段的全部标注。
     * @return 该单据最新的标注列表
     */
    public List<Map<String, Object>> erase(String panelCode, String docNo, String fieldKey,
                                           Integer start, Integer end, String user) {
        perms.requireButton(panelCode, "保存");
        String fk = require(fieldKey, "字段", MAX_FIELD_KEY);
        String dn = require(docNo, "单据编号", MAX_DOC_NO);
        if (start != null && end != null) {
            if (end <= start) throw new IllegalArgumentException("擦除范围不合法");
            jdbc.update("UPDATE yj_doc_annotation SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                            + " WHERE panel_code=? AND doc_no=? AND field_key=? AND ISNULL(asp_cancel,'N')<>'Y'"
                            + "   AND start_pos < ? AND end_pos > ?",
                    user, panelCode, dn, fk, end, start);
        } else {
            jdbc.update("UPDATE yj_doc_annotation SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                            + " WHERE panel_code=? AND doc_no=? AND field_key=? AND ISNULL(asp_cancel,'N')<>'Y'",
                    user, panelCode, dn, fk);
        }
        return query(panelCode, dn);
    }

    private List<Map<String, Object>> query(String panelCode, String docNo) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, field_key, start_pos, end_pos, color, bold FROM yj_doc_annotation"
                        + " WHERE panel_code=? AND doc_no=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " ORDER BY field_key, start_pos, id", panelCode, docNo);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.get("id"));
            m.put("fieldKey", String.valueOf(r.get("field_key")));
            m.put("start", ((Number) r.get("start_pos")).intValue());
            m.put("end", ((Number) r.get("end_pos")).intValue());
            m.put("color", String.valueOf(r.get("color")));
            m.put("bold", Boolean.TRUE.equals(r.get("bold")) || Integer.valueOf(1).equals(r.get("bold")));
            out.add(m);
        }
        return out;
    }

    private static String require(String v, String what, int max) {
        String s = v == null ? "" : v.trim();
        if (s.isEmpty()) throw new IllegalArgumentException(what + "不能为空");
        if (s.length() > max) throw new IllegalArgumentException(what + "过长");
        return s;
    }
}
