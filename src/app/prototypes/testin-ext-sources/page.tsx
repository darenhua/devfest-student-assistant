import { getFindingsCache, getSourceLinks } from "./actions";
import type { Finding } from "./types";
import { AgentPanel } from "./agent-panel";
import { SourceManager } from "./source-manager";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  homework: { label: "Homework", color: "text-orange-400" },
  exam: { label: "Exam", color: "text-red-400" },
  office_hours: { label: "Office Hours", color: "text-green-400" },
  syllabus: { label: "Syllabus", color: "text-blue-400" },
  lecture: { label: "Lecture", color: "text-purple-400" },
  other: { label: "Other", color: "text-gray-400" },
};

function FindingCard({ finding }: { finding: Finding }) {
  const typeInfo = TYPE_LABELS[finding.type] || TYPE_LABELS.other;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 space-y-1">
      <div className="flex justify-between items-start gap-2">
        <h3 className="font-semibold text-sm leading-tight">{finding.title}</h3>
        <span className={`text-xs whitespace-nowrap shrink-0 font-medium ${typeInfo.color}`}>
          {typeInfo.label}
        </span>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{finding.description}</p>
      <div className="text-xs text-gray-500 space-y-0.5">
        {finding.due_date && <p>Due: {finding.due_date}</p>}
        {finding.time_info && <p>Time: {finding.time_info}</p>}
        {finding.location && <p>Location: {finding.location}</p>}
        {finding.source_url && (
          <a
            href={finding.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-400 truncate block"
          >
            {(() => {
              try { return new URL(finding.source_url).pathname; }
              catch { return finding.source_url; }
            })()}
          </a>
        )}
      </div>
    </div>
  );
}

export default async function TestinExtSourcesPage() {
  const [cache, links] = await Promise.all([getFindingsCache(), getSourceLinks()]);

  // Group findings by type
  const groupedFindings: Record<string, Finding[]> = {};
  for (const f of cache.findings) {
    const type = f.type || "other";
    if (!groupedFindings[type]) groupedFindings[type] = [];
    groupedFindings[type].push(f);
  }

  // Sort type groups by priority
  const typeOrder = ["homework", "exam", "office_hours", "syllabus", "lecture", "other"];
  const sortedTypes = typeOrder.filter((t) => groupedFindings[t]?.length);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">External Sources Agent</h1>
          <p className="text-gray-400 mt-1">
            MCP-powered agent that crawls course homepages to discover
            assignments, exams, office hours, and syllabi
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Agent panel */}
          <AgentPanel />

          {/* Right: Sources + Findings */}
          <div className="space-y-6">
            {/* Source manager */}
            <SourceManager initialLinks={links} />

            {/* Findings section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Findings</h2>
                <span className="text-xs text-gray-500">
                  {cache.findings.length} finding{cache.findings.length !== 1 && "s"}
                </span>
              </div>

              {cache.findings.length === 0 ? (
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-center text-sm text-gray-500">
                  No findings yet. Use the agent to crawl your sources.
                </div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {sortedTypes.map((type) => (
                    <div key={type} className="space-y-2">
                      <h3 className={`text-sm font-medium ${TYPE_LABELS[type]?.color || "text-gray-400"}`}>
                        {TYPE_LABELS[type]?.label || type} ({groupedFindings[type].length})
                      </h3>
                      {groupedFindings[type].map((f) => (
                        <FindingCard key={f.id} finding={f} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Last updated */}
            {cache.lastUpdated && (
              <p className="text-xs text-gray-600 text-right">
                Last updated: {new Date(cache.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
