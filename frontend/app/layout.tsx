import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "SMART Aqua Pond", description: "Aquaculture pond monitoring and management dashboard" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
