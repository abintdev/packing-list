import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Packing List Generator",
  description: "Editable shipment packing list PDF generator",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}