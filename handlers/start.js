const { getOrCreateUser, getMainMenuKeyboard, getStudentMenuKeyboard, isStudent } = require('./common');
const { logAction } = require('../logger');

module.exports = async (ctx) => {
  try {
    const user = await getOrCreateUser(ctx);

    let welcomeMessage;
    let keyboard;

    if (isStudent(user)) {
      welcomeMessage = `
Добро пожаловать, студент!

Здесь вы можете:
- Просмотреть свои ответы на обращения
- Проверить текущее обращение в работе
- Посмотреть статистику своей работы

Выберите действие из меню ниже:
`;
      keyboard = getStudentMenuKeyboard();
    } else {
      welcomeMessage = `
Добро пожаловать в бот юридической клиники!

Здесь вы можете:
- Задать юридический вопрос
- Просмотреть часто задаваемые вопросы (FAQ)
- Отслеживать статус ваших обращений

Выберите действие из меню ниже:
`;
      keyboard = getMainMenuKeyboard();
    }

    await ctx.reply(welcomeMessage, keyboard);
    await logAction('user_start_command', { userId: user._id, role: user.role });
  } catch (error) {
    console.error('Error in start handler:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз позже.');
  }
};