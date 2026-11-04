"use client";
import Link from "next/link";
import { Layers3, Moon, Sun } from "lucide-react";
import { create } from "zustand";
import { Button } from "./ui/button";
const useTheme = create<{ dark: boolean; toggle: () => void }>((set) => ({
  dark: false,
  toggle: () =>
    set((state) => {
      document.documentElement.dataset.theme = state.dark ? "light" : "dark";
      return { dark: !state.dark };
    }),
}));
export function Header() {
  const { dark, toggle } = useTheme();
  return (
    <header className="header">
      <Link href="/" className="brand">
        <Layers3 aria-hidden="true" />
        FolioForge
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/#tools">All tools</Link>
        <Link href="/#privacy">Privacy</Link>
        <Button
          variant="ghost"
          onClick={toggle}
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </Button>
      </nav>
    </header>
  );
}
