package com.yinjia.mes.tools;

import net.sf.jasperreports.engine.JRException;
import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.design.JasperDesign;
import net.sf.jasperreports.engine.xml.JRXmlLoader;

import java.io.FileInputStream;

/** 打印 title/pageFooter 高度 + Jasper 编译的完整错误链。 */
public class ValidateCheck {
    public static void main(String[] args) throws Exception {
        String path = args[0];
        JasperDesign jd = JRXmlLoader.load(new FileInputStream(path));
        System.out.println("page=" + jd.getPageWidth() + "x" + jd.getPageHeight()
            + " t=" + jd.getTopMargin() + " b=" + jd.getBottomMargin());
        int pf = jd.getPageFooter() == null ? 0 : jd.getPageFooter().getHeight();
        int lpf = jd.getLastPageFooter() == null ? 0 : jd.getLastPageFooter().getHeight();
        int ph = jd.getPageHeader() == null ? 0 : jd.getPageHeader().getHeight();
        int ch = jd.getColumnHeader() == null ? 0 : jd.getColumnHeader().getHeight();
        int th = jd.getTitle() == null ? 0 : jd.getTitle().getHeight();
        System.out.println("titleH=" + th + " pageHeaderH=" + ph + " columnHeaderH=" + ch);
        System.out.println("pageFooterH=" + pf + " lastPageFooterH=" + lpf);
        System.out.println("usableForTitle=" + (jd.getPageHeight() - jd.getTopMargin() - jd.getBottomMargin() - ph - pf - lpf));
        try {
            JasperCompileManager.compileReport(path);
            System.out.println("COMPILE_OK");
        } catch (JRException e) {
            System.out.println("JREX_MSG=" + e.getMessage());
            Throwable c = e;
            while (c != null) {
                System.out.println("  CHAIN " + c.getClass().getSimpleName() + " : " + c.getMessage());
                c = c.getCause() == c ? null : c.getCause();
            }
        }
    }
}
