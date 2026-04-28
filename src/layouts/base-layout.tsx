import type React from "react";
import DragWindowRegion from "@/components/drag-window-region";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DragWindowRegion title="Miru Time Desktop" />
      <main className="h-[calc(100vh-2rem)] p-2 pt-0">{children}</main>
    </>
  );
}
