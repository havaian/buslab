export enum RequestStatus {
  PENDING = 'pending',             // Ожидает проверки администратором
  APPROVED = 'approved',           // Одобрено, доступно студентам
  IN_PROGRESS = 'in_progress',     // Студент взял в работу
  ANSWER_REVIEW = 'answer_review', // Ответ отправлен, ожидает проверки администратором
  CLOSED = 'closed',               // Закрыто, ответ отправлен пользователю
  REJECTED = 'rejected',           // Отклонено администратором
}