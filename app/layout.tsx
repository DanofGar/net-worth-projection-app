import type { Metadata } from "next";
import { Newsreader, DM_Sans } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "./components/Toast";

const newsreader = Newsreader({ 
  subsets: ['latin'], 
  variable: '--font-heading' 
});

const dmSans = DM_Sans({ 
  subsets: ['latin'], 
  variable: '--font-body' 
});

export const metadata: Metadata = {
  title: "Net Worth Projection",
  description: "60-day financial projections dashboard",
  manifest: "/manifest.json",
  themeColor: "#D97757",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FinTrack",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${newsreader.variable} ${dmSans.variable} antialiased`}
      >
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
