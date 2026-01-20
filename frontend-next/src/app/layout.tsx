import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { QueryProvider } from "@/lib/query-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Jacob Hanif AI Coach",
  description: "Your personal calisthenics and strength training coach",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
