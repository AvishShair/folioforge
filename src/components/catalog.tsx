"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Search,
  ArrowUpRight,
  Combine,
  Scissors,
  RotateCw,
  Images,
  ImageDown,
  Stamp,
  LayoutGrid,
  FileSearch,
  Minimize2,
  Scaling,
  RefreshCw,
  FlipHorizontal,
  Crop,
  Layers3,
} from "lucide-react";
import { tools } from "@/lib/domain";
const icons = [
  Combine,
  Scissors,
  RotateCw,
  Images,
  ImageDown,
  Stamp,
  LayoutGrid,
  FileSearch,
  Minimize2,
  Scaling,
  RefreshCw,
  FlipHorizontal,
  Crop,
  Layers3,
];
export function ToolCatalog() {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All tools");
  const filtered = tools.filter(
    (t) =>
      (category === "All tools" || t.category === category) &&
      `${t.name} ${t.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section id="tools" className="catalog">
      <div className="catalog-title">
        <div>
          <p className="eyebrow">The toolkit</p>
          <h2>Small tasks. Sorted.</h2>
        </div>
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search tools"
            placeholder="What do you need to do?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="tabs" aria-label="Filter tools">
        {["All tools", "PDF", "Image"].map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
            {c === "All tools" && <span>{tools.length}</span>}
          </button>
        ))}
      </div>
      <div className="tool-grid">
        {filtered.map((t) => {
          const Icon =
            icons[(tools.indexOf(t) + icons.length - 6) % icons.length];
          return (
            <Link href={t.route} key={t.id} className="tool-card">
              <div className="card-top">
                <span
                  className={`tool-icon ${t.category === "Image" ? "image-icon" : ""}`}
                >
                  <Icon size={23} />
                </span>
                <ArrowUpRight className="card-arrow" size={19} />
              </div>
              <h3>{t.name}</h3>
              <p>{t.description}</p>
            </Link>
          );
        })}
      </div>
      {!filtered.length && (
        <p className="empty">No matching tools. Try “PDF” or “resize”.</p>
      )}
    </section>
  );
}
