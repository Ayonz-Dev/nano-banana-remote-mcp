import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataForge Studio — public data into shareable charts",
  description:
    "Turn public datasets into precise, branded, social-ready charts and captions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
