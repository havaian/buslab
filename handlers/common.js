const { Markup } = require('telegraf');
const User = require('../models/user');
const { logAction } = require('../logger');
const { t } = require('../utils/i18nHelper');

/**
 * Create or update user in database
 * @param {Object} ctx - Telegram context
 * @returns {Promise<Object>} - User object
 */
const getOrCreateUser = async (ctx) => {
  const telegramUser = ctx.from;

  try {
    let user = await User.findOne({ telegramId: telegramUser.id });

    if (!user) {
      user = new User({
        telegramId: telegramUser.id,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username,
        language: 'ru' // Default language
      });

      await user.save();
      logAction('user_registered', { userId: user._id });
    }

    return user;
  } catch (error) {
    console.error('Error getting or creating user:', error);
    throw error;
  }
};

/**
 * Get main menu keyboard for regular users
 * @param {Object} ctx - Telegram context for translations
 * @returns {Object} - Keyboard markup
 */
const getMainMenuKeyboard = (ctx) => {
  return Markup.keyboard([
    [t(ctx, 'buttons.ask_question')],
    [t(ctx, 'buttons.faq')],
    [t(ctx, 'buttons.my_requests')],
    [t(ctx, 'buttons.help'), '🌐 Language']
  ]).resize();
};

/**
 * Get student menu keyboard
 * @param {Object} ctx - Telegram context for translations
 * @returns {Object} - Keyboard markup
 */
const getStudentMenuKeyboard = (ctx) => {
  return Markup.keyboard([
    [t(ctx, 'buttons.current_assignment')],
    [t(ctx, 'buttons.my_answers')]
  ]).resize();
};

/**
 * Back button keyboard
 * @param {Object} ctx - Telegram context for translations
 * @param {String} text - Custom text (optional)
 * @returns {Object} - Keyboard markup
 */
const getBackKeyboard = (ctx, text = null) => {
  const buttonText = text || t(ctx, 'buttons.back');
  return Markup.keyboard([[buttonText]]).resize();
};

/**
 * Check if user is admin
 * @param {Object} user - User object
 * @returns {Boolean} - Is admin
 */
const isAdmin = (user) => {
  return user.role === 'admin';
};

/**
 * Check if user is student
 * @param {Object} user - User object
 * @returns {Boolean} - Is student
 */
const isStudent = (user) => {
  return user.role === 'student';
};

/**
 * Check if user is in student chat (can take requests)
 * @param {Object} ctx - Telegram context
 * @returns {Boolean} - Is in student chat
 */
const isInStudentChat = (ctx) => {
  return ctx.chat && ctx.chat.id.toString() === process.env.STUDENT_CHAT_ID;
};

/**
 * Check if user can take requests (is in student chat)
 * @param {Object} ctx - Telegram context
 * @returns {Boolean} - Can take requests
 */
const canTakeRequests = (ctx) => {
  return isInStudentChat(ctx);
};

module.exports = {
  getOrCreateUser,
  getMainMenuKeyboard,
  getStudentMenuKeyboard,
  getBackKeyboard,
  isAdmin,
  isStudent,
  isInStudentChat,
  canTakeRequests
};