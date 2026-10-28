package com.yinjia.mes.service;

import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.converter.WordToHtmlConverter;
import org.apache.poi.hwpf.usermodel.Range;
import org.springframework.stereotype.Service;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * 老二进制 Word(.doc,OLE2/HWPF)转 HTML —— 供附件「点开就看」用(2026-10-28)。
 *
 * <p>为什么需要:现场附件《开题报告-修改版.doc》文件头是 {@code D0 CF 11 E0}(OLE2 复合文档),
 * 不是「docx 改名」—— 浏览器与 docx-preview 都解析不了,此前只能下载后用 Word 打开。
 * 用户口径:「上传的附件…看看能不能加上预览的功能就不需要每次都下载再看,归档的也是一样」。
 *
 * <p>做法:Apache POI HWPF 解析 .doc,{@link WordToHtmlConverter} 转成 HTML 片段;
 * 前端用 iframe(srcdoc)展示,自带样式,不依赖外部资源。
 *
 * <p>安全与边界:
 * · 只读解析,不执行任何宏/脚本(POI 不跑 VBA);
 * · 输出 HTML 做最简转义兜底(转换器已产出结构化 HTML,这里只清 <script>);
 * · 解析失败/文件不是 .doc 一律抛 IllegalArgumentException,由调用方降级为下载;
 * · 不做 .docx 转换 —— 那条走前端 docx-preview(见 attachmentPreview.js)。
 */
@Service
public class DocPreviewService {

    /** 转换上限:超过这个体积不做在线转换(避免超大文档卡住请求线程),由前端降级下载。 */
    private static final long MAX_PREVIEW_BYTES = 15L * 1024 * 1024;

    /**
     * 把 .doc 转成自包含 HTML 文档(带内联样式,可直接塞进 iframe srcdoc)。
     *
     * @param path 附件磁盘路径
     * @param title 标题(原文件名,仅用于 &lt;title&gt;)
     * @return 完整 HTML 文档字符串
     */
    public String docToHtml(Path path, String title) {
        try {
            long size = Files.size(path);
            if (size <= 0) throw new IllegalArgumentException("附件内容为空");
            if (size > MAX_PREVIEW_BYTES) {
                throw new IllegalArgumentException("文件超过 " + (MAX_PREVIEW_BYTES / 1024 / 1024) + "MB,不支持在线预览");
            }
            try (InputStream in = Files.newInputStream(path);
                 HWPFDocument doc = new HWPFDocument(in)) {
                org.w3c.dom.Document html = DocumentBuilderFactory.newInstance()
                        .newDocumentBuilder().newDocument();
                WordToHtmlConverter converter = new WordToHtmlConverter(html);
                Range range = doc.getRange();
                converter.processDocumentPart(doc, range);
                String body = toHtmlString(converter.getDocument());
                return wrap(title, body);
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            // 解析失败(文件损坏/加密/其实是 docx 等)→ 交给前端降级下载
            throw new IllegalArgumentException("该文档不支持在线预览:" + e.getClass().getSimpleName());
        }
    }

    /** DOM → HTML 字符串(UTF-8) */
    private static String toHtmlString(org.w3c.dom.Document doc) throws Exception {
        Transformer t = TransformerFactory.newInstance().newTransformer();
        t.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        t.setOutputProperty(OutputKeys.METHOD, "html");
        t.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "yes");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        t.transform(new DOMSource(doc), new StreamResult(out));
        String html = out.toString(StandardCharsets.UTF_8);
        // 兜底:转换器已输出结构化 HTML,仍显式剔除脚本标签(任何情况下不得带脚本进来)
        return html.replaceAll("(?is)<script[^>]*>.*?</script>", "");
    }

    /** 套一层页面骨架:白纸版面 + 打印友好 + 图片自适应 */
    private static String wrap(String title, String bodyHtml) {
        String safeTitle = String.valueOf(title == null ? "" : title)
                .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
        return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" + safeTitle + "</title>"
                + "<style>"
                + "body{margin:0;padding:24px;background:#f2f3f5;}"
                + ".doc-page{max-width:820px;margin:0 auto;background:#fff;padding:32px 28px;"
                + "box-shadow:0 1px 4px rgba(0,0,0,.12);font:14px/1.8 -apple-system,'Segoe UI','Microsoft YaHei',serif;color:#222;}"
                + ".doc-page table{border-collapse:collapse;max-width:100%;}"
                + ".doc-page td,.doc-page th{border:1px solid #999;padding:4px 8px;}"
                + ".doc-page img{max-width:100%;height:auto;}"
                + ".doc-page p{margin:0 0 8px;}"
                + "</style></head><body><div class=\"doc-page\">" + bodyHtml + "</div></body></html>";
    }
}
