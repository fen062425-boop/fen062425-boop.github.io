import "../styles/globals.css";

export const metadata = {
  title: "设计师作品集 · Visual Designer Portfolio",
  description: "平面设计师个人作品集，涵盖品牌视觉、电商设计、活动主视觉与 AIGC 工作流。",
  icons: {
    icon: "/favicon.svg"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#10110f"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
