"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SourceLink } from "./types";

export function SourceManager({ initialLinks }: { initialLinks: SourceLink[] }) {
  const router = useRouter();
  const [links, setLinks] = useState<SourceLink[]>(initialLinks);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function addSource() {
    if (!newUrl.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/prototypes/testin-ext-sources/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl.trim(), label: newLabel.trim() }),
      });
      if (res.ok) {
        const newLink = await res.json();
        setLinks((prev) => [...prev, newLink]);
        setNewUrl("");
        setNewLabel("");
        setShowAdd(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeSource(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/prototypes/testin-ext-sources/links?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== id));
        router.refresh();
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sources</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {links.length} source{links.length !== 1 && "s"}
          </span>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-lg flex items-center justify-center transition-colors"
            title="Add source"
          >
            +
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-lg border border-blue-800 bg-blue-950/30 p-3 space-y-2">
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://www.cs.columbia.edu/~prof/course/"
            className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && addSource()}
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (optional, e.g. 'OS W4118')"
            className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && addSource()}
          />
          <div className="flex gap-2">
            <button
              onClick={addSource}
              disabled={saving || !newUrl.trim()}
              className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {saving ? "Adding..." : "Add Source"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Links list */}
      {links.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-center text-sm text-gray-500">
          No sources yet. Click + to add course homepage URLs.
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="rounded-lg border border-gray-800 bg-gray-900 p-3 flex justify-between items-start gap-2"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm truncate">{link.label}</h3>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 truncate block"
                >
                  {link.url}
                </a>
              </div>
              <button
                onClick={() => removeSource(link.id)}
                disabled={deleting === link.id}
                className="text-gray-600 hover:text-red-400 text-sm shrink-0 transition-colors"
                title="Remove source"
              >
                {deleting === link.id ? "..." : "x"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
