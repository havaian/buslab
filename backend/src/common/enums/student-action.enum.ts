export enum StudentAction {
  TOOK_REQUEST = "took_request", // Взял обращение в работу
  SUBMITTED_ANSWER = "submitted_answer", // Отправил ответ на проверку
  ANSWER_APPROVED = "answer_approved", // Ответ одобрен администратором
  ANSWER_REJECTED = "answer_rejected", // Ответ отклонён администратором
  DECLINED_REQUEST = "declined_request", // Отказался от обращения
  UNASSIGNED_BY_ADMIN = "unassigned_by_admin", // Задание снято администратором
  TIMER_EXPIRED = "timer_expired", // Таймер истёк
}
