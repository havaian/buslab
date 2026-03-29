interface TelegramLoginOptions {
  client_id: string | number;
  request_access?: ("phone" | "write")[];
  lang?: string;
}

type TelegramCallback = (result: {
  id_token?: string;
  user?: Record<string, unknown>;
  error?: string;
}) => void;

declare global {
  interface Window {
    Telegram?: {
      Login: {
        init: (
          options: TelegramLoginOptions,
          callback: TelegramCallback
        ) => void;
        open: (callback?: TelegramCallback) => void;
      };
      WebApp: {
        ready: () => void;
        expand: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
        };
        colorScheme: "light" | "dark";
        themeParams: Record<string, string>;
        MainButton: {
          show: () => void;
          hide: () => void;
          setText: (text: string) => void;
          onClick: (fn: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
        };
        close: () => void;
      };
    };
  }
}

export {};
