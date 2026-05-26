import type { Metadata } from "next";
import "./globals.scss";

export const metadata: Metadata = {
  title: "wMEP Modular Demo",
  description:
    "AI Demo for UI/UX modularization on top of the Web Module Export Protocol (wMEP). Every panel is a wMEP module living in its own directory.",
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
