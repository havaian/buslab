import { FileText, Download } from "lucide-react";

interface FileEntry {
  filename?: string;
  originalName?: string;
  mimetype?: string;
  size?: number;
  ref?: string;
  source?: "telegram" | "web";
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function downloadFile(file: FileEntry) {
  // Files from both "web" and "telegram" sources are stored locally by ref (UUID filename)
  if (!file.ref) return;

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`/api/files/${file.ref}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    alert("Не удалось скачать файл");
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.originalName || file.filename || "file";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function FileList({ files }: { files?: FileEntry[] | null }) {
  if (!files?.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((f, i) => {
        const name = f.originalName || f.filename || "файл";
        const size = formatSize(f.size);
        const canDownload = !!f.ref;

        return (
          <button
            key={i}
            type="button"
            disabled={!canDownload}
            onClick={() => downloadFile(f)}
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed max-w-64"
          >
            <FileText size={14} className="shrink-0 text-muted-foreground" />
            <span className="truncate text-left">
              {name}
              {size && (
                <span className="text-muted-foreground ml-1">({size})</span>
              )}
            </span>
            <Download
              size={12}
              className="shrink-0 text-muted-foreground ml-auto"
            />
          </button>
        );
      })}
    </div>
  );
}
