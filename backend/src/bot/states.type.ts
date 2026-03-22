// ── Citizen multi-step state ──────────────────────────────────────────────

export type UserState =
  | { state: "selecting_category" }
  | { state: "entering_request"; categoryId: string; categoryName: string }
  | {
      state: "attaching_files";
      categoryId: string;
      categoryName: string;
      requestText: string;
      requestFiles: {
        fileId: string;
        originalName: string;
        mimeType: string;
      }[];
    }
  | {
      state: "confirming_request";
      categoryId: string;
      categoryName: string;
      requestText: string;
      requestFiles: {
        fileId: string;
        originalName: string;
        mimeType: string;
      }[];
    }
  | { state: "selecting_faq_category" }
  | { state: "selecting_faq_item"; categoryId: string };

// ── Admin multi-step state (entered in admin group chat) ──────────────────

export type AdminState =
  | {
      state: "entering_decline_reason";
      requestId: string;
      /** message_id of the bot's prompt in admin chat (for cleanup if needed) */
      promptMessageId: number;
    }
  | {
      state: "entering_answer_decline_reason";
      requestId: string;
      promptMessageId: number;
    };
