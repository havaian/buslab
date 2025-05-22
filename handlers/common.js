const { Markup } = require('telegraf');
const User = require('../models/user');
const { logAction } = require('../logger');

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
        username: telegramUser.username
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
 * @returns {Object} - Keyboard markup
 */
const getMainMenuKeyboard = () => {
  return Markup.keyboard([
    ['Задать вопрос'],
    ['FAQ'],
    ['Мои обращения'],
    ['❓ Помощь']
  ]).resize();
};

/**
 * Get student menu keyboard
 * @returns {Object} - Keyboard markup
 */
const getStudentMenuKeyboard = () => {
  return Markup.keyboard([
    ['Текущее обращение'],
    ['Мои ответы']
  ]).resize();
};

/**
 * Back button keyboard
 * @returns {Object} - Keyboard markup
 */
const getBackKeyboard = (text = 'Назад') => {
  return Markup.keyboard([[text]]).resize();
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