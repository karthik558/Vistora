import type { Metadata } from "next";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/dm-mono/latin-400.css";
import "@fontsource/dm-mono/latin-500.css";
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/playfair-display/latin-400-italic.css";
import "@fontsource/playfair-display/latin-500.css";
import "@fontsource/playfair-display/latin-500-italic.css";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/playfair-display/latin-600-italic.css";
import "./globals.css";
import "./dark-theme.css";
import "./platform.css";
import "./hospitality.css";
import "./operations.css";
import "./workspace-ui.css";

export const metadata: Metadata = {
  title: "Vistora | Guest Experience Operations",
  description: "A premium guest feedback and service recovery operations workspace.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-blue.ico", type: "image/x-icon" },
      { url: "/favicon-green.ico", type: "image/x-icon" },
    ],
    shortcut: "/favicon.ico",
    apple: "/vistora_logo_blue.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/x-icon" href="/favicon-blue.ico" />
        <link rel="apple-touch-icon" href="/vistora_logo_blue.webp" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var theme = localStorage.getItem("vistora-theme") === "dark" ? "dark" : "light";
                document.documentElement.setAttribute("data-theme", theme);
              } catch(e) {}
            })();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
