import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  title: "حاسبة تكلفة المطبخ | Kitchen Cost Calculator",
  description:
    "احسب تكلفة المطبخ حسب الخامة: أضف الخامات وأسعارها، ثم الوحدات (عادية، أدراج، زجاج، دواليب، حرف L، جوانب) واحصل على المساحة والتكلفة لكل خامة والإجمالي فوراً.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.className} antialiased`}>{children}</body>
    </html>
  );
}
