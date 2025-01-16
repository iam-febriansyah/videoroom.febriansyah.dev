/* eslint-disable @next/next/no-sync-scripts */
import type { Metadata } from "next";
import "./globals.css";
import FloatingMenu from "./components/BottomMenu";
import { GlobalProvider } from "./context/GlobalContext";
import SidebarMenu from "./components/SideBarMenu";
import { SocketProvider } from "./context/SocketContext";

export const metadata: Metadata = {
  title: "Video Room",
  description: "Video Room",
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode;}>) {
    return (
      <html lang="en">
          <body>
          <GlobalProvider>
              <SocketProvider>
                <SidebarMenu />
                <div className="px-2 py-16">{children}</div>
                <FloatingMenu />
              </SocketProvider>
          </GlobalProvider>
          </body>
      </html>
    );
}
