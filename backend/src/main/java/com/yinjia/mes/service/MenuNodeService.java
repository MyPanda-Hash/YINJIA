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
 * 菜单覆盖(系统管理平台 · 菜单设计)—— 只存人能改的四件事:名称 / 上级 / 排序 / 隐藏。
 *
 * <p>分层理由(与前端 {@code business/menuOverrides.js} 头注释同一口径):
 * 导航**基线**在代码 {@code frontend/src/business/menus.js} 里 —— 每个节点的
 * {@code code/path/panelCode/icon/adminOnly} 是数据键,和路由注册、权限词、面板元数据一一对应,
 * 搬进库就会与代码脱钩,一次误改能打出「点不开的菜单」。本表只存**覆盖**:
 * 有行的节点按本表显示,没行的节点按代码显示(所以代码里新加的面板不会因为库没跟上而隐身)。
 *
 * <p>保存口径 = **整表替换**({@link #replaceAll} 先删后插,同一事务):菜单是一棵有序树,
 * 挪一个位置要动一排 {@code seq};逐行 upsert 会把「半棵树」的中间态暴露给正在读的客户端,
 * 也容易留脏行。整体替换 = 要么全生效、要么全不变。
 *
 * <p>权限:读 = 任何登录账号(每个客户端渲染导航都要读);写 = 管理员(见 {@code SysMenuController})。
 */
@Service
public class MenuNodeService {

    /** 节点上限(现役菜单约 300 个节点;给足余量但挡住异常请求) */
    private static final int MAX_NODES = 2000;
    private static final int MAX_CODE = 64;
    private static final int MAX_TITLE = 100;
    private static final int MAX_ICON = 50;

    private static final String SELECT_SQL = """
            SELECT menu_code, parent_code, title, seq, hidden, is_new, icon, operator, updated_at
              FROM yj_menu_node
             ORDER BY ISNULL(parent_code, N''), seq, id""";

    private static final String INSERT_SQL = """
            INSERT INTO yj_menu_node
                (menu_code, parent_code, title, seq, hidden, is_new, icon, operator, updated_at,
                 asp_user1, asp_time1, asp_user2, asp_time2)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, SYSDATETIME(), ?, SYSDATETIME(), ?, SYSDATETIME())""";

    private final JdbcTemplate jdbc;

    public MenuNodeService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 全部覆盖行(空 = 一切按代码基线)。前端 {@code applyMenuOverrides} 合并。 */
    public List<Map<String, Object>> list() {
        return jdbc.query(SELECT_SQL, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("menuCode", rs.getString("menu_code"));
            m.put("parentCode", rs.getString("parent_code"));
            m.put("title", rs.getString("title"));
            m.put("seq", rs.getInt("seq"));
            m.put("hidden", rs.getBoolean("hidden"));
            m.put("isNew", rs.getBoolean("is_new"));
            m.put("icon", rs.getString("icon"));
            m.put("operator", rs.getString("operator"));
            Object at = rs.getObject("updated_at");
            m.put("updatedAt", at == null ? null : String.valueOf(at).replace('T', ' '));
            return m;
        });
    }

    /** 覆盖行数(概览/提示用;0 = 未定制) */
    public int count() {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM yj_menu_node", Integer.class);
        return n == null ? 0 : n;
    }

    /**
     * 整表替换(管理员)。空列表 = 清回代码基线。
     *
     * @param nodes 形如 {@code [{menuCode,parentCode,title,seq,hidden,isNew,icon}]}
     * @param operator 操作人(写进 operator 与审计列)
     */
    @Transactional
    public Map<String, Object> replaceAll(List<Map<String, Object>> nodes, String operator) {
        List<Map<String, Object>> clean = validate(nodes);
        jdbc.update("DELETE FROM yj_menu_node");
        for (Map<String, Object> n : clean) {
            jdbc.update(INSERT_SQL,
                    n.get("menuCode"), n.get("parentCode"), n.get("title"), n.get("seq"),
                    n.get("hidden"), n.get("isNew"), n.get("icon"),
                    operator, operator, operator);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("count", clean.size());
        out.put("operator", operator);
        out.put("updatedAt", LocalDateTime.now().withNano(0).toString().replace('T', ' '));
        return out;
    }

    /** 清空覆盖 ⇒ 全部回到代码基线(管理员) */
    @Transactional
    public Map<String, Object> reset(String operator) {
        int before = count();
        jdbc.update("DELETE FROM yj_menu_node");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("cleared", before);
        out.put("count", 0);
        out.put("operator", operator);
        return out;
    }

    // ============ 校验(坏数据一律 400,不静默修) ============

    private List<Map<String, Object>> validate(List<Map<String, Object>> nodes) {
        if (nodes == null) return List.of();
        if (nodes.size() > MAX_NODES) {
            throw new IllegalArgumentException("菜单节点不能超过 " + MAX_NODES + " 项(本次 " + nodes.size() + " 项)");
        }
        List<Map<String, Object>> out = new ArrayList<>(nodes.size());
        Set<String> codes = new LinkedHashSet<>();
        Map<String, String> parentOf = new HashMap<>();

        int idx = 0;
        for (Map<String, Object> raw : nodes) {
            idx++;
            if (raw == null) throw new IllegalArgumentException("第 " + idx + " 项菜单节点为空");
            String code = str(raw.get("menuCode"));
            if (code.isEmpty()) throw new IllegalArgumentException("第 " + idx + " 项缺少节点编码");
            if (code.length() > MAX_CODE) throw new IllegalArgumentException("节点编码过长(最多 " + MAX_CODE + " 字符):" + code);
            if (!code.equals(code.replaceAll("[\\s\\u0000-\\u001f]", ""))) {
                throw new IllegalArgumentException("节点编码不能含空格或控制字符:" + code);
            }
            if (!codes.add(code)) throw new IllegalArgumentException("节点编码重复:" + code);

            String title = str(raw.get("title"));
            if (title.isEmpty()) throw new IllegalArgumentException("菜单「" + code + "」的名称为空");
            if (title.length() > MAX_TITLE) {
                throw new IllegalArgumentException("菜单名称过长(最多 " + MAX_TITLE + " 字):" + title);
            }

            String parent = str(raw.get("parentCode"));
            if (parent.isEmpty()) parent = null;
            else if (parent.equals(code)) throw new IllegalArgumentException("菜单「" + title + "」的上级不能是它自己");

            String icon = str(raw.get("icon"));
            if (icon.length() > MAX_ICON) icon = icon.substring(0, MAX_ICON);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("menuCode", code);
            row.put("parentCode", parent);
            row.put("title", title);
            row.put("seq", toInt(raw.get("seq"), out.size()));
            row.put("hidden", toBool(raw.get("hidden")));
            row.put("isNew", toBool(raw.get("isNew")));
            row.put("icon", icon.isEmpty() ? null : icon);
            out.add(row);
            parentOf.put(code, parent);
        }

        // 上级必须存在(没有父节点的子树等于凭空消失,报错比默默丢更好)
        for (Map<String, Object> row : out) {
            String parent = (String) row.get("parentCode");
            if (parent != null && !codes.contains(parent)) {
                throw new IllegalArgumentException("菜单「" + row.get("title") + "」的上级节点不存在:" + parent);
            }
        }
        // 成环检查(父子链路上撞回自己)
        for (String code : codes) {
            Set<String> seen = new LinkedHashSet<>();
            String cur = code;
            while (cur != null) {
                if (!seen.add(cur)) {
                    throw new IllegalArgumentException("菜单节点「" + code + "」的上级关系成环");
                }
                cur = parentOf.get(cur);
            }
        }
        return out;
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private static int toInt(Object v, int dflt) {
        if (v instanceof Number n) return n.intValue();
        String s = str(v);
        if (s.isEmpty()) return dflt;
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return dflt;
        }
    }

    private static boolean toBool(Object v) {
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) return n.intValue() != 0;
        String s = str(v);
        return "true".equalsIgnoreCase(s) || "1".equals(s) || "Y".equalsIgnoreCase(s) || "是".equals(s);
    }
}
