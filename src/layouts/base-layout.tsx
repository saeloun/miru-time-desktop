import type React from "react";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="h-screen">{children}</main>;
}
