import com.lowagie.text.pdf.PdfReader;

import java.nio.file.Paths;

/** _PdfPageSize — 打印/落纸校验:页数 + 每页尺寸(pt 与 mm)。用法: java -cp <openpdf> _PdfPageSize.java <pdf> */
public class _PdfPageSize {
    public static void main(String[] args) throws Exception {
        try (PdfReader reader = new PdfReader(Paths.get(args[0]).toString())) {
            int pages = reader.getNumberOfPages();
            System.out.println("pages=" + pages);
            for (int i = 1; i <= pages; i++) {
                com.lowagie.text.Rectangle r = reader.getPageSize(i);
                System.out.printf("page %d: %.2f x %.2f pt = %.2f x %.2f mm%n",
                        i, r.getWidth(), r.getHeight(), r.getWidth() / 72 * 25.4, r.getHeight() / 72 * 25.4);
            }
        }
    }
}
