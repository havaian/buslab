"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

type Variant = "default" | "destructive";

interface AlertOptions {
  title?: string;
  variant?: Variant;
  confirmLabel?: string;
}

interface ConfirmOptions {
  title?: string;
  variant?: Variant;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PromptOptions {
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  variant?: Variant;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface DialogContextValue {
  /** Shows a message dialog. Resolves when user clicks OK. */
  alert: (message: string, options?: AlertOptions) => Promise<void>;
  /** Shows a yes/no dialog. Resolves true on confirm, false on cancel/close. */
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  /** Shows a text input dialog. Resolves with the string on confirm, null on cancel/close. */
  prompt: (message: string, options?: PromptOptions) => Promise<string | null>;
}

// ── Internal dialog state ─────────────────────────────────────────────────

type DialogState =
  | {
      type: "alert";
      message: string;
      options: AlertOptions;
      resolve: () => void;
    }
  | {
      type: "confirm";
      message: string;
      options: ConfirmOptions;
      resolve: (v: boolean) => void;
    }
  | {
      type: "prompt";
      message: string;
      options: PromptOptions;
      resolve: (v: string | null) => void;
    };

// ── Context ───────────────────────────────────────────────────────────────

const DialogContext = createContext<DialogContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const close = useCallback(() => setDialog(null), []);

  const alert = useCallback(
    (message: string, options: AlertOptions = {}): Promise<void> =>
      new Promise((resolve) => {
        setDialog({ type: "alert", message, options, resolve });
      }),
    []
  );

  const confirm = useCallback(
    (message: string, options: ConfirmOptions = {}): Promise<boolean> =>
      new Promise((resolve) => {
        setDialog({ type: "confirm", message, options, resolve });
      }),
    []
  );

  const prompt = useCallback(
    (message: string, options: PromptOptions = {}): Promise<string | null> =>
      new Promise((resolve) => {
        setDialog({ type: "prompt", message, options, resolve });
      }),
    []
  );

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      {dialog && <DialogRenderer dialog={dialog} onClose={close} />}
    </DialogContext.Provider>
  );
}

// ── Renderer ──────────────────────────────────────────────────────────────

function DialogRenderer({
  dialog,
  onClose,
}: {
  dialog: DialogState;
  onClose: () => void;
}) {
  const [inputValue, setInputValue] = useState(
    dialog.type === "prompt" ? dialog.options.defaultValue ?? "" : ""
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input for prompt
  useEffect(() => {
    if (dialog.type === "prompt") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [dialog.type]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enter to confirm (prompt)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && dialog.type === "prompt") handleConfirm();
  };

  const handleConfirm = () => {
    if (dialog.type === "alert") {
      dialog.resolve();
    } else if (dialog.type === "confirm") {
      dialog.resolve(true);
    } else if (dialog.type === "prompt") {
      dialog.resolve(inputValue.trim() || null);
    }
    onClose();
  };

  const handleCancel = () => {
    if (dialog.type === "confirm") dialog.resolve(false);
    else if (dialog.type === "prompt") dialog.resolve(null);
    onClose();
  };

  const isDestructive = dialog.options.variant === "destructive";

  const title =
    dialog.options.title ??
    (dialog.type === "alert"
      ? "Уведомление"
      : dialog.type === "confirm"
      ? "Подтверждение"
      : "Введите значение");

  const confirmLabel =
    dialog.options.confirmLabel ??
    (dialog.type === "alert" ? "ОК" : "Подтвердить");

  const cancelLabel =
    dialog.type !== "alert"
      ? (dialog.options as ConfirmOptions).cancelLabel ?? "Отмена"
      : null;

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Close on overlay click only for alert (confirm/prompt need explicit choice)
        if (e.target === e.currentTarget && dialog.type === "alert") {
          handleConfirm();
        }
      }}
    >
      {/* Dialog box */}
      <div
        className={cn(
          "relative w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl mx-4",
          "animate-in fade-in-0 zoom-in-95 duration-150"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Close button */}
        <button
          className="absolute right-4 top-4 rounded-sm opacity-60 hover:opacity-100 transition-opacity"
          onClick={handleCancel}
          aria-label="Закрыть"
        >
          <X size={15} />
        </button>

        {/* Title */}
        <h2
          id="dialog-title"
          className={cn(
            "text-base font-semibold leading-tight mb-3 pr-6",
            isDestructive && "text-destructive"
          )}
        >
          {title}
        </h2>

        {/* Message */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          {dialog.message}
        </p>

        {/* Prompt input */}
        {dialog.type === "prompt" && (
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={dialog.options.placeholder}
            onKeyDown={handleKeyDown}
            className="mb-4"
          />
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          {cancelLabel && (
            <Button variant="outline" size="sm" onClick={handleCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button
            variant={isDestructive ? "destructive" : "default"}
            size="sm"
            onClick={handleConfirm}
            disabled={
              dialog.type === "prompt" &&
              !inputValue.trim() &&
              !dialog.options.defaultValue
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used inside DialogProvider");
  return ctx;
}
