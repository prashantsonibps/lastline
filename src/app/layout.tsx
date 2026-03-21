import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lastline",
  description: "AI SDK and Chat SDK control surface for PR review delivery",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
