import "./globals.css";

export const metadata = {
  title: "Fruehstueck Bestellen",
  description: "Camping breakfast ordering MVP"
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
