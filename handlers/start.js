const { getOrCreateUser, getMainMenuKeyboard, getStudentMenuKeyboard, isAdmin, isStudent } = require('./common');
const { logAction } = require('../logger');

module.exports = async (ctx) => {
  try {
    const user = await getOrCreateUser(ctx);
    
    let welcomeMessage = '';
    let keyboard;
    
    if (isAdmin(user)) {
      // Admin welcome message
      welcomeMessage = `
🔧 Добро пожаловать, администратор!

Ваши команды:
• /add_category - Добавить категорию
• /edit_category - Редактировать категорию  
• /delete_category - Удалить категорию
• /add_faq - Добавить FAQ
• /edit_faq - Редактировать FAQ
• /delete_faq - Удалить FAQ
• /categories - Список категорий
• /faqs - Список FAQ
• /requests - Список обращений
• /stats - Статистика

Также доступны обычные функции пользователя:
`;
      keyboard = getMainMenuKeyboard();
    } else if (isStudent(user)) {
      // Student welcome message
      welcomeMessage = `
👨‍🎓 Добро пожаловать, студент!

Ваши возможности:
• Принимать обращения в работу (в студенческом чате)
• Отвечать на юридические вопросы
• Отслеживать свои задания

Также доступны обычные функции пользователя:
`;
      keyboard = user.currentAssignmentId ? getStudentMenuKeyboard() : getMainMenuKeyboard();
    } else {
      // Regular user welcome message
      welcomeMessage = `
Добро пожаловать в бот юридической клиники!

Здесь вы можете:
• Задать юридический вопрос
• Просмотреть часто задаваемые вопросы (FAQ)
• Отслеживать статус ваших обращений

Выберите действие из меню ниже:
`;
      keyboard = getMainMenuKeyboard();
    }
    
    await ctx.reply(welcomeMessage, keyboard);
    await logAction('user_start_command', { 
      userId: user._id, 
      role: user.role,
      hasActiveAssignment: user.currentAssignmentId !== null
    });
  } catch (error) {
    console.error('Error in start handler:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз позже.');
  }
};