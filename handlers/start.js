const { getOrCreateUser, getMainMenuKeyboard, getStudentMenuKeyboard, isStudent } = require('./common');
const { logAction } = require('../logger');
const { t } = require('../utils/i18nHelper');

module.exports = async (ctx) => {
  try {
    const user = await getOrCreateUser(ctx);

    let welcomeMessage;
    let keyboard;

    if (isStudent(user)) {
      welcomeMessage = t(ctx, 'commands.start.welcome_student');
      keyboard = getStudentMenuKeyboard(ctx);
    } else {
      welcomeMessage = t(ctx, 'commands.start.welcome_user');
      keyboard = getMainMenuKeyboard(ctx);
    }

    await ctx.reply(welcomeMessage, keyboard);
    await logAction('user_start_command', { userId: user._id, role: user.role });
  } catch (error) {
    console.error('Error in start handler:', error);
    await ctx.reply(t(ctx, 'errors.general'));
  }
};