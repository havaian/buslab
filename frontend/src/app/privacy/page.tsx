"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Воркер лежит в public/ — скопирован из node_modules/pdfjs-dist при билде (см. Dockerfile)
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type Locale = "ru" | "uz" | "en";

const LOCALE_LABELS: Record<Locale, string> = {
  ru: "Русский",
  uz: "O'zbek",
  en: "English",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function PrivacyPage() {
  const [available, setAvailable] = useState<Record<Locale, boolean>>({
    ru: false,
    uz: false,
    en: false,
  });
  const [locale, setLocale] = useState<Locale>("ru");
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Следим за шириной контейнера для адаптивного рендера страниц PDF
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/legal`)
      .then((r) => r.json())
      .then((data: Record<Locale, boolean>) => {
        setAvailable(data);
        const first = (["ru", "uz", "en"] as Locale[]).find((l) => data[l]);
        if (first) setLocale(first);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const availableLocales = (["ru", "uz", "en"] as Locale[]).filter(
    (l) => available[l]
  );

  const fileUrl = `${API_BASE}/legal/${locale}/file`;

  // Ширина страницы: вся ширина контейнера с отступами по бокам, максимум 900px
  const pageWidth =
    containerWidth > 0 ? Math.min(containerWidth - 32, 900) : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between sticky top-0 bg-background z-10">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Логотип" className="h-7 w-7" />
          <span className="font-semibold text-sm">Юридическая клиника</span>
        </div>
        {availableLocales.length > 1 && (
          <div className="flex gap-1">
            {availableLocales.map((l) => (
              <button
                key={l}
                onClick={() => {
                  setNumPages(null);
                  setLocale(l);
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  locale === l
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {LOCALE_LABELS[l]}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <main
        ref={containerRef}
        className="flex-1 flex flex-col items-center py-4"
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Загрузка...
          </div>
        ) : availableLocales.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Документ ещё не загружен.
          </div>
        ) : !available[locale] ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Документ на выбранном языке недоступен.
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={
              <div className="flex items-center justify-center text-sm text-muted-foreground pt-16">
                Загрузка документа...
              </div>
            }
            error={
              <div className="flex items-center justify-center text-sm text-muted-foreground pt-16">
                Не удалось загрузить документ.
              </div>
            }
            className="flex flex-col items-center gap-2 w-full"
          >
            {Array.from({ length: numPages ?? 0 }, (_, i) => (
              <Page
                key={i + 1}
                pageNumber={i + 1}
                width={pageWidth}
                renderTextLayer
                renderAnnotationLayer
                className="shadow-sm"
              />
            ))}
          </Document>
        )}

        {numPages !== null && (
          <p className="text-xs text-muted-foreground mt-4 mb-2">
            {numPages}{" "}
            {numPages === 1
              ? "страница"
              : numPages < 5
              ? "страницы"
              : "страниц"}
          </p>
        )}
      </main>
    </div>
  );
}
