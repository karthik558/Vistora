import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

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
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
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
