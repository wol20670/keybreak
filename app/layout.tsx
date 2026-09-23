import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// The terminal face: every label, readout and number. Variable weight, so the
// wordmark and the in-game shouts can lean on 800 without a second request.
const mono = JetBrains_Mono({
  variable: "--font-mono-src",
  subsets: ["latin"],
  display: "swap",
});

const body = Noto_Sans_KR({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KEYBREAK — 30초 디버깅 보스 레이드",
  description:
    "폭주한 시스템을 강제 종료하라. 30초 동안 A S D F를 연타해 버그를 부수는 디버깅 보스 레이드.",
};

export const viewport: Viewport = {
  themeColor: "#0E1420",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${mono.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
