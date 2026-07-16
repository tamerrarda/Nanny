"use client";

import { motion } from "framer-motion";

export type Tab = "vault" | "activity" | "agent";

/**
 * Every item here is a real destination. There are deliberately only three:
 * a nav that lists Rules/Settings/etc. and does nothing when clicked is a
 * screenshot, not a product. Rules live on the vault itself, so they are shown
 * where they are enforced rather than behind a dead link.
 */
const ITEMS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "vault",
    label: "Vault",
    icon: (
      <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Zm0 2.3L5.5 8.2v7.6L12 19.2l6.5-3.4V8.2L12 4.8Zm0 3.2a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" />
    ),
  },
  {
    key: "activity",
    label: "Activity",
    icon: (
      <path d="M4 19.5h16v2H2v-19h2v17Zm3.3-3.1-1.4-1.4 4.6-4.6 3 3 4.9-4.9 1.4 1.4-6.3 6.3-3-3-3.2 3.2Z" />
    ),
  },
  {
    key: "agent",
    label: "Agent",
    icon: (
      <path d="M13 2v2.5h3.5A3.5 3.5 0 0 1 20 8v8a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16V8a3.5 3.5 0 0 1 3.5-3.5H11V2h2ZM7.5 6.5A1.5 1.5 0 0 0 6 8v8a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 16V8a1.5 1.5 0 0 0-1.5-1.5h-9ZM9.5 10a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm5 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
    ),
  },
];

export function Sidebar({
  tab,
  setTab,
  unlocked,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  /** Activity and Agent need a vault to talk about; until one exists they say so. */
  unlocked: boolean;
}) {
  return (
    <nav
      aria-label="Sections"
      className="hud hud-frame hud-sm sticky top-20 hidden h-fit backdrop-blur-xl lg:block"
    >
      <div className="hud hud-body hud-sm flex flex-col gap-1 p-2">
        {ITEMS.map((item) => {
          const locked = item.key !== "vault" && !unlocked;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => !locked && setTab(item.key)}
              disabled={locked}
              aria-current={active ? "page" : undefined}
              title={locked ? "Open a vault first" : undefined}
              className={`hud hud-sm group relative flex w-[74px] flex-col items-center gap-1.5 px-2 py-3 transition-colors duration-200 ${
                active
                  ? "text-brand-text"
                  : locked
                    ? "cursor-not-allowed text-ink-dim/50"
                    : "cursor-pointer text-ink-soft hover:bg-white/5 hover:text-ink"
              }`}
            >
              {/* One element slides between tabs instead of three cross-fading —
                  the movement is what tells you where the selection went. */}
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="hud hud-sm absolute inset-0 -z-10 bg-brand/20 ring-1 ring-inset ring-brand/45"
                />
              )}
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className={`h-5 w-5 transition-transform duration-200 ${
                  active
                    ? "drop-shadow-[0_0_8px_rgba(168,85,247,0.9)]"
                    : locked
                      ? ""
                      : "group-hover:-translate-y-0.5"
                }`}
              >
                {item.icon}
              </svg>
              <span className="font-display text-[10px] font-bold uppercase tracking-widest">
                {item.label}
              </span>
              {locked && (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  className="h-3 w-3"
                >
                  <path d="M12 2a5 5 0 0 1 5 5v2h1.5A1.5 1.5 0 0 1 20 10.5v9A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5v-9A1.5 1.5 0 0 1 5.5 9H7V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v2h6V7a3 3 0 0 0-3-3Z" />
                </svg>
              )}
              {locked && <span className="sr-only">(open a vault first)</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
