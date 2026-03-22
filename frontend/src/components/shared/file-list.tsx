import { FileText, ImageIcon, Download } from "lucide-react";

interface FileEntry {
  filename?: string;
  originalName?: string;
  mimetype?: string;
  size?: number;
  ref?: string;
  source?: "telegram" | "web";
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function fileUrl(file: FileEntry): string {
  // ServeStaticModule serves /static/uploads/:filename without auth,
  // so <a download> works correctly in the browser.
  if (file.source === "web" && file.ref) return `/static/uploads/${file.ref}`;
  return "#";
}

export function FileList({ files }: { files?: FileEntry[] | null }) {
  if (!files?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((f, i) => {
        const isImage = IMAGE_TYPES.includes(f.mimetype || "");
        const url = fileUrl(f);
        const name = f.originalName || f.filename || "файл";
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download={name}
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-accent max-w-56 truncate"
          >
            {isImage ? (
              <ImageIcon size={14} className="shrink-0" />
            ) : (
              <FileText size={14} className="shrink-0" />
            )}
            <span className="truncate">{name}</span>
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
