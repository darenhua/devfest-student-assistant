"use client";

import { Menu, Settings, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type SidebarPanel = "menu" | "settings" | null;

export default function FloatingBarPage() {
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>(null);

  function toggleSidebar(panel: SidebarPanel) {
    setSidebarPanel((prev) => (prev === panel ? null : panel));
  }

  return (
    <div className="relative flex h-screen flex-col">
      {/* Dock at bottom */}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-0.5 rounded-full border border-gray-200 bg-white px-1 py-0.5 shadow-md">
        <Button
          className="h-6 w-6 rounded-full"
          onClick={() => toggleSidebar("menu")}
          size="icon"
          variant={sidebarPanel === "menu" ? "default" : "ghost"}
        >
          <Menu className="h-3 w-3" />
        </Button>
        <Button
          className="h-6 w-6 rounded-full"
          onClick={() => toggleSidebar("settings")}
          size="icon"
          variant={sidebarPanel === "settings" ? "default" : "ghost"}
        >
          <Settings className="h-3 w-3" />
        </Button>
      </div>

      {/* Full-height sidebar panel */}
      <div
        className={`fixed top-3 right-3 bottom-3 z-30 transition-all duration-300 ${sidebarPanel
          ? "translate-x-0 opacity-100"
          : "pointer-events-none translate-x-full opacity-0"
          }`}
      >
        <div className="flex h-full w-80 flex-col rounded-xl border bg-background/95 shadow-xl backdrop-blur-sm">
          {/* Sidebar header with close button */}
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="font-semibold">
              {sidebarPanel === "menu" ? "Menu" : "Settings"}
            </h3>
            <Button
              className="h-8 w-8"
              onClick={() => setSidebarPanel(null)}
              size="icon"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Sidebar content - scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            {sidebarPanel === "menu" && (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">Menu content</p>
              </div>
            )}

            {sidebarPanel === "settings" && (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Settings content
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
