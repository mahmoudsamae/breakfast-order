import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";

export const metadata = {
  title: "Fruehstueck Bestellen",
  description: "Camping breakfast ordering MVP"
};

export default function RootLayout({ children }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
