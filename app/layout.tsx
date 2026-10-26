import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import "./dark-theme.css";
import "./platform.css";
import "./hospitality.css";
import "./workspace-ui.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

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
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/x-icon" href="/favicon-blue.ico" />
        <link rel="apple-touch-icon" href="/vistora_logo_blue.webp" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var p = window.location.pathname;
                if (p === "/" || p === "/login" || p.indexOf("/guest") === 0) {
                  document.documentElement.setAttribute("data-theme", "light");
                  return;
                }
                var theme = localStorage.getItem("vistora-theme") || "light";
                document.documentElement.setAttribute("data-theme", theme);
              } catch(e) {}
            })();`,
          }}
        />
      </head>
      <body className={dmSans.className}>{children}</body>
    </html>
  );
}
