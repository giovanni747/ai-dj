"use client";

import clsx from "clsx";
import { useState } from "react";

const navItems = {
  "dj": {
    name: "DJ",
  },
  "dashboard": {
    name: "Dashboard",
  },
  "personal": {
    name: "Personal",
  },
};

export type NavTab = "dj" | "dashboard" | "personal";

interface MorphicNavbarProps {
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
}

export function MorphicNavbar({ activeTab = "dj", onTabChange }: MorphicNavbarProps) {
  const [localActiveTab, setLocalActiveTab] = useState<NavTab>(activeTab);

  const handleTabClick = (tab: NavTab) => {
    setLocalActiveTab(tab);
    onTabChange?.(tab);
  };

  const currentTab = activeTab || localActiveTab;

  const isActiveLink = (tab: string) => {
    return currentTab === tab;
  };

  return (
    <nav className="mx-auto max-w-4xl px-4 md:px-12 py-2">
      <div className="flex items-center justify-center">
        {/* Removed glass effect classes (bg-white/5, backdrop-blur, etc) */}
        <div className="flex items-center justify-between overflow-hidden rounded-xl">
          {Object.entries(navItems).map(([tab, { name }], index, array) => {
            const isActive = isActiveLink(tab);
            const isFirst = index === 0;
            const isLast = index === array.length - 1;
            const prevTab = index > 0 ? array[index - 1][0] : null;
            const nextTab =
              index < array.length - 1 ? array[index + 1][0] : null;

            return (
              <button
                key={tab}
                onClick={() => handleTabClick(tab as NavTab)}
                className={clsx(
                  "flex items-center justify-center bg-black p-1.5 px-4 text-sm text-white transition-all duration-300 dark:bg-white dark:text-black cursor-pointer min-w-[80px]",
                  isActive
                    ? "mx-2 rounded-xl font-semibold text-sm"
                    : clsx(
                      (isActiveLink(prevTab || "") || isFirst) &&
                      "rounded-l-xl",
                      (isActiveLink(nextTab || "") || isLast) &&
                      "rounded-r-xl"
                    )
                )}
              >
                {tab === "dj" ? "Chat" : tab === "dashboard" ? "Dash" : tab === "personal" ? "Settings" : name}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default MorphicNavbar;
