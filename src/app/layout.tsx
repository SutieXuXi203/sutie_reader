import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/providers/ThemeProvider";
import { SmoothScrollProvider } from "@/providers/SmoothScrollProvider";
import { UploadProgressProvider } from "@/providers/UploadProgressProvider";
import { SiteNav } from "@/components/SiteNav";
import { GooeyToastProvider } from "@/components/GooeyToastProvider";
import { DevPointerCaptureGuard } from "@/components/DevPointerCaptureGuard";
import "./globals.css";
import "goey-toast/styles.css";
import { cn } from "@/lib/utils";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getCurrentUser } from "@/lib/server-auth";

const sfPro = localFont({
  src: [
    {
      path: "../../public/fonts/SFPRODISPLAYTHINITALIC.otf",
      weight: "100",
      style: "italic",
    },
    {
      path: "../../public/fonts/SFPRODISPLAYULTRALIGHTITALIC.otf",
      weight: "200",
      style: "italic",
    },
    {
      path: "../../public/fonts/SFPRODISPLAYLIGHTITALIC.otf",
      weight: "300",
      style: "italic",
    },
    {
      path: "../../public/fonts/SFPRODISPLAYREGULAR.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/SFPRODISPLAYMEDIUM.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/SFPRODISPLAYSEMIBOLDITALIC.otf",
      weight: "600",
      style: "italic",
    },
    {
      path: "../../public/fonts/SFPRODISPLAYBOLD.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/SFPRODISPLAYHEAVYITALIC.otf",
      weight: "800",
      style: "italic",
    },
    {
      path: "../../public/fonts/SFPRODISPLAYBLACKITALIC.otf",
      weight: "900",
      style: "italic",
    },
  ],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Lubu Corp",
  description:
    "Lubu Corp – Nền tảng đọc truyện tranh, tiểu thuyết và sáng tác nội dung sáng tạo.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    siteName: "Lubu Corp",
    title: "Lubu Corp",
    description:
      "Lubu Corp – Nền tảng đọc truyện tranh, tiểu thuyết và sáng tác nội dung sáng tạo.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Lubu Corp logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Lubu Corp",
    description:
      "Lubu Corp – Nền tảng đọc truyện tranh, tiểu thuyết và sáng tác nội dung sáng tạo.",
    images: ["/logo.png"],
  },
};
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getCurrentUser();

  return (
    <html lang="vi" suppressHydrationWarning className={cn("font-sans", sfPro.variable)}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof Element !== 'undefined' && Element.prototype) {
                  var origSetAttr = Element.prototype.setAttribute;
                  Element.prototype.setAttribute = function(name, value) {
                    if (name === 'bis_skin_checked') return;
                    return origSetAttr.call(this, name, value);
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${sfPro.variable} font-sans antialiased bg-background text-foreground relative`}
        suppressHydrationWarning
      >
        <div className="fixed top-14 inset-x-0 bottom-0 pointer-events-none z-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,theme(colors.primary)_1px,transparent_0)] bg-[size:28px_28px] opacity-[0.06] dark:opacity-[0.04]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,theme(colors.foreground)_1px,transparent_1px),linear-gradient(theme(colors.foreground)_1px,transparent_1px)] bg-[size:180px_180px] opacity-[0.025] dark:opacity-[0.035]" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/0 to-background/35 dark:to-background/55" />
        </div>
        <div className="relative z-10 flex flex-col min-h-screen">
          <DevPointerCaptureGuard />
          <Providers initialUser={initialUser}>
            <UploadProgressProvider>
              <SmoothScrollProvider>
                <SiteNav />
                {children}
                <GooeyToastProvider />
              </SmoothScrollProvider>
            </UploadProgressProvider>
          </Providers>
        </div>
        <SpeedInsights />
      </body>
    </html>
  );
}
