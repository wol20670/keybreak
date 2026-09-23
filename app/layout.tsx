import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Press_Start_2P } from "next/font/google";
import "./globals.css";

// Latin-only pixel face: used for arcade labels and numbers, never Korean text.
const pixel = Press_Start_2P({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const body = Noto_Sans_KR({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KEYBREAK — 키보드 파괴왕",
  description: "키보드를 부숴라. 기록을 남겨라. 30초 ASDF 연타 아케이드 게임.",
};

export const viewport: Viewport = {
  themeColor: "#11131C",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${pixel.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
