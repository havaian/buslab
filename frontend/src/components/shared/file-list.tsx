import { FileText, Image as ImageIcon, Download } from "lucide-react";
import type { AttachedFile } from "@/lib/api";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function fileUrl(file: AttachedFile): string {
  if (file.source === "web") return `/api/files/${file.ref}`;
  // Telegram files are fetched through bot — show placeholder or skip download
  return "#";
}

export function FileList({ files }: { files: AttachedFile[] }) {
  if (!files?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((f, i) => {
        const isImage = IMAGE_TYPES.includes(f.mimetype);
        const url = fileUrl(f);
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download={f.originalName}
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-accent max-w-56 truncate"
          >
            {isImage ? (
              <ImageIcon size={14} className="shrink-0" />
            ) : (
              <FileText size={14} className="shrink-0" />
            )}
            <span className="truncate">{f.originalName}</span>
            <Download
              size={12}
              className="shrink-0 text-muted-foreground ml-auto"
            />
          </a>
        );
      })}
    </div>
  );
}
