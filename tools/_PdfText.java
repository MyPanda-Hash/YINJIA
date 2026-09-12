import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;

/**
 * _PdfText — 用 openpdf(与后端同一文本抽取器)解 PDF 文本层,验证中文与字段值真的可被解出。
 * 用法: java -cp "openpdf-1.3.32.jar;." _PdfText <in.pdf> <out.txt>
 * 输出: out.txt(UTF-8,逐页文本);stdout 打印页数与字符数。
 * 只读:不修改 PDF 本体。
 */
public class _PdfText {
    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("usage: _PdfText <in.pdf> <out.txt>");
            System.exit(2);
        }
        byte[] pdf = Files.readAllBytes(Paths.get(args[0]));
        PdfReader reader = new PdfReader(pdf);
        int pages = reader.getNumberOfPages();
        StringBuilder sb = new StringBuilder();
        PdfTextExtractor extractor = new PdfTextExtractor(reader);
        for (int i = 1; i <= pages; i++) {
            sb.append("=== page ").append(i).append(" ===\n");
            sb.append(extractor.getTextFromPage(i)).append('\n');
        }
        reader.close();
        Files.write(Paths.get(args[1]), sb.toString().getBytes(StandardCharsets.UTF_8));
        File out = new File(args[1]);
        System.out.println("pages=" + pages + " chars=" + out.length());
    }
}
