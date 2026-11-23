/* 一次性探针:验证 PanelRegistry.PanelDef.detailTabLabel() 的真实解析行为(不起服务、不重启 8090)
   用法:
     CP="backend/target/classes;<jackson-databind>;<jackson-core>;<jackson-annotations>;<slf4j-api>"
     javac -encoding UTF-8 -cp "$CP" -d /tmp/probe tools/archive/_sample-catalog-20261119/_ProbeDetailTabLabel.java
     java -Dstdout.encoding=UTF-8 -cp "$CP;/tmp/probe" _ProbeDetailTabLabel
   期望:①本次迁移写入的 config ⇒ 「内部检测目录」;②config=NULL / 缺键 / 合法空串 / 非法 JSON / 非字符串 ⇒ null(回落原逻辑)。*/
import com.yinjia.mes.service.PanelRegistry;

public class _ProbeDetailTabLabel {
    static com.yinjia.mes.service.PanelRegistry.PanelDef defWith(String config) {
        return new PanelRegistry.PanelDef(
                "SAMPLE_REG", "送样登记表", "Sample Submission Register", "样品检验", "archive",
                "qc_sample_reg", null, null, "id", "检测元素", null, null, null,
                "items", "样品检验", config, java.util.List.of());
    }

    static int bad = 0;

    static void expect(String label, String config, String want) {
        String got = defWith(config).detailTabLabel();
        boolean ok = (want == null) ? (got == null) : want.equals(got);
        if (!ok) bad++;
        System.out.printf("%-46s config=%-58s ⇒ %-20s 期望=%-20s %s%n",
                label, config == null ? "<NULL>" : config, got == null ? "<null>" : got,
                want == null ? "<null>" : want, ok ? "[PASS]" : "[FAIL]");
    }

    public static void main(String[] args) {
        // 迁移后本库真实 config(只读自 yj_panel;此处按 SQL 复核结果原样写死)
        expect("① 迁移后的真实 config", "{\"uniqueKeys\":[[\"检测元素\"]],\"detailTabLabel\":\"内部检测目录\"}", "内部检测目录");
        expect("② 只有 detailTabLabel", "{\"detailTabLabel\":\"内部检测目录\"}", "内部检测目录");
        expect("③ 其它键共存(uniqueKeys 在前/后都行)", "{\"detailTabLabel\":\"内部检测目录\",\"uniqueKeys\":[[\"检测元素\"]]}", "内部检测目录");
        expect("④ config=NULL(未声明的面板)", null, null);
        expect("⑤ config 空串", "", null);
        expect("⑥ 合法 JSON 但缺键", "{\"uniqueKeys\":[[\"检测元素\"]]}", null);
        expect("⑦ 值是非字符串(null)", "{\"detailTabLabel\":null}", null);
        expect("⑧ 值是空串(回落原逻辑)", "{\"detailTabLabel\":\"  \"}", null);
        expect("⑨ 值是数字(非字符串 ⇒ 取不到)", "{\"detailTabLabel\":123}", null);
        expect("⑩ 非法 JSON(只 warn,不抛)", "{not-json", null);
        System.out.println(bad == 0
                ? "RESULT: PASS 10/10 detailTabLabel 解析符合口径(缺省/非法一律 null,不抛)"
                : "RESULT: FAIL bad=" + bad);
        System.exit(bad == 0 ? 0 : 1);
    }
}
