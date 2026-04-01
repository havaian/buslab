// Единый компонент для отображения статуса "Активен / Заблокирован"
// Используется в: users/page, users/[id]/page, students/[id]/page

interface BannedBadgeProps {
  isBanned: boolean | undefined;
}

export function BannedBadge({ isBanned }: BannedBadgeProps) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        isBanned
          ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
          : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
      }`}
    >
      {isBanned ? "Заблокирован" : "Активен"}
    </span>
  );
}
