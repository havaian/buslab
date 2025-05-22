require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const mongoose = require('mongoose');

// Import handlers
const startHandler = require('./handlers/start');
const userHandlers = require('./handlers/user');
const adminHandlers = require('./handlers/admin');
const studentHandlers = require('./handlers/student');
const categoryHandlers = require('./handlers/category');
const faqHandlers = require('./handlers/faq');
const requestHandlers = require('./handlers/request');
const helpHandlers = require('./handlers/help'); // Keep help handlers

// Import logger
const { logAction, logUserMessage, logError, logInfo, logWarn } = require('./logger');

// Check required environment variables
const requiredEnvVars = ['BOT_TOKEN', 'MONGO_URI', 'ADMIN_CHAT_ID', 'STUDENT_CHAT_ID'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logError(new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`));
  process.exit(1);
}

// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    logInfo('Connected to MongoDB', { database: process.env.MONGO_URI.split('/').pop() });
  })
  .catch(err => {
    logError(err, { context: 'MongoDB connection failed' });
    process.exit(1);
  });

// Setup middleware
bot.use(session());

// Enhanced logging middleware
bot.use(async (ctx, next) => {
  try {
    if (ctx.message && ctx.message.text) {
      logUserMessage(ctx.from, ctx.message.text);
    }

    // Log callback queries
    if (ctx.callbackQuery) {
      logAction('callback_query', {
        userId: ctx.from.id,
        username: ctx.from.username,
        data: ctx.callbackQuery.data
      });
    }

    return next();
  } catch (error) {
    logError(error, { context: 'Logging middleware error' });
    return next();
  }
});

// Command handlers
bot.start(startHandler);

// Help commands - context-aware (KEEP THIS)
bot.command('help', (ctx) => {
  // Determine context and call appropriate help handler
  if (ctx.chat.id.toString() === process.env.ADMIN_CHAT_ID) {
    helpHandlers.handleAdminHelp(ctx);
  } else if (ctx.chat.id.toString() === process.env.STUDENT_CHAT_ID) {
    helpHandlers.handleStudentHelp(ctx);
  } else if (ctx.chat.type === 'private') {
    helpHandlers.handleUserHelp(ctx);
  }
  // If none of the conditions match, the command is ignored
});

// Admin commands (only work for admins)
bot.command('getadmin', adminHandlers.handleGetAdmin);
bot.command('add_category', adminHandlers.handleAddCategory);
bot.command('edit_category', adminHandlers.handleEditCategory);
bot.command('delete_category', adminHandlers.handleDeleteCategory);
bot.command('add_faq', adminHandlers.handleAddFAQ);
bot.command('edit_faq', adminHandlers.handleEditFAQ);
bot.command('delete_faq', adminHandlers.handleDeleteFAQ);
bot.command('categories', categoryHandlers.handleListCategories);
bot.command('faqs', faqHandlers.handleListFAQs);
bot.command('requests', requestHandlers.handleListRequests);
bot.command('stats', requestHandlers.handleStats);

// User action handlers (available to all roles)
bot.hears('Задать вопрос', userHandlers.handleAskQuestion);
bot.hears('FAQ', userHandlers.handleFAQ);
bot.hears('Мои обращения', userHandlers.handleMyRequests);
bot.hears('Назад', userHandlers.handleBack);
bot.hears('❓ Помощь', userHandlers.handleHelp); // Keep help button handler

// Student-specific handlers
bot.hears('Текущее обращение', studentHandlers.handleMyAssignment);
bot.hears('Подтвердить отправку ответа', (ctx) => studentHandlers.handleConfirmAnswer(ctx, bot));
bot.hears('Изменить ответ', studentHandlers.handleEditAnswer);
bot.hears('Отказаться от обращения', (ctx) => studentHandlers.handleRejectAssignment(ctx, bot));

// Admin callback handlers
bot.action(/approve_request:(.+)/, (ctx) => adminHandlers.handleApproveRequest(ctx, bot));
bot.action(/decline_request:(.+)/, adminHandlers.handleDeclineRequest);
bot.action(/approve_answer:(.+)/, (ctx) => adminHandlers.handleApproveAnswer(ctx, bot));
bot.action(/decline_answer:(.+)/, adminHandlers.handleDeclineAnswer);
bot.action(/edit_category:(.+)/, adminHandlers.handleEditCategorySelection);
bot.action(/edit_category_name:(.+)/, adminHandlers.handleEditCategoryName);
bot.action(/edit_category_hashtag:(.+)/, adminHandlers.handleEditCategoryHashtag);
bot.action(/delete_category:(.+)/, adminHandlers.handleDeleteCategorySelection);
bot.action(/confirm_delete_category:(.+)/, adminHandlers.handleDeleteCategoryConfirmation);
bot.action(/select_faq_category:(.+)/, adminHandlers.handleFAQCategorySelectionAdmin);
bot.action(/edit_faq_select_category:(.+)/, adminHandlers.handleEditFAQCategorySelection);
bot.action(/edit_faq:(.+)/, adminHandlers.handleEditFAQSelection);
bot.action(/edit_faq_question:(.+)/, adminHandlers.handleEditFAQQuestion);
bot.action(/edit_faq_answer:(.+)/, adminHandlers.handleEditFAQAnswer);
bot.action(/edit_faq_category:(.+)/, adminHandlers.handleEditFAQCategory);
bot.action(/set_faq_category:(.+)/, adminHandlers.handleSetFAQCategory);
bot.action(/delete_faq_select_category:(.+)/, adminHandlers.handleDeleteFAQSelection);
bot.action(/delete_faq:(.+)/, adminHandlers.handleDeleteFAQFromCategory);
bot.action(/confirm_delete_faq:(.+)/, adminHandlers.handleConfirmDeleteFAQ);
bot.action('cancel_edit_category', adminHandlers.handleCancel);
bot.action('cancel_delete_category', adminHandlers.handleCancel);
bot.action('cancel_edit_faq', adminHandlers.handleCancel);
bot.action('cancel_delete_faq', adminHandlers.handleCancel);

// Student callback handlers
bot.action(/take_request:(.+)/, (ctx) => studentHandlers.handleTakeRequest(ctx, bot));
bot.action(/edit_answer:(.+)/, studentHandlers.handleEditAnswerCallback);
bot.action(/reject_assignment:(.+)/, (ctx) => studentHandlers.handleRejectAssignment(ctx, bot));

// Handle category selection in user flow
bot.on('message', async (ctx, next) => {
  try {
    const userState = userHandlers.userStates.get(ctx.from.id);

    if (!userState) {
      return next();
    }

    // Handle different states
    switch (userState.state) {
      case 'selecting_category':
        await userHandlers.handleCategorySelection(ctx);
        break;
      case 'entering_request':
        await userHandlers.handleRequestText(ctx);
        break;
      case 'confirming_request':
        if (ctx.message.text === 'Подтвердить') {
          await userHandlers.handleRequestConfirmation(ctx, bot);
        } else if (ctx.message.text === 'Изменить') {
          await userHandlers.handleEditRequest(ctx);
        }
        break;
      case 'selecting_faq_category':
        await userHandlers.handleFAQCategorySelection(ctx);
        break;
      case 'selecting_faq':
        await userHandlers.handleFAQSelection(ctx);
        break;
      default:
        return next();
    }
  } catch (error) {
    logError(error, { context: 'User state handler error', userId: ctx.from.id });
    return next();
  }
});

// Handle admin state management
bot.on('message', async (ctx, next) => {
  try {
    const adminState = adminHandlers.adminStates.get(ctx.from.id);

    if (!adminState) {
      return next();
    }

    // Handle different admin states
    switch (adminState.state) {
      case 'entering_decline_reason':
        await adminHandlers.handleDeclineReason(ctx, bot);
        break;
      case 'entering_answer_decline_reason':
        await adminHandlers.handleAnswerDeclineReason(ctx, bot);
        break;
      case 'entering_category_name':
        await adminHandlers.handleCategoryName(ctx);
        break;
      case 'entering_category_hashtag':
        await adminHandlers.handleCategoryHashtag(ctx);
        break;
      case 'entering_new_category_name':
        await adminHandlers.handleNewCategoryName(ctx);
        break;
      case 'entering_new_category_hashtag':
        await adminHandlers.handleNewCategoryHashtag(ctx);
        break;
      case 'entering_faq_question':
        await adminHandlers.handleFAQQuestion(ctx);
        break;
      case 'entering_faq_answer':
        await adminHandlers.handleFAQAnswer(ctx);
        break;
      case 'entering_new_faq_question':
        await adminHandlers.handleNewFAQQuestion(ctx);
        break;
      case 'entering_new_faq_answer':
        await adminHandlers.handleNewFAQAnswer(ctx);
        break;
      default:
        return next();
    }
  } catch (error) {
    logError(error, { context: 'Admin state handler error', userId: ctx.from.id });
    return next();
  }
});

// Handle student answer submission
bot.on('message', async (ctx, next) => {
  try {
    // Skip command messages
    if (ctx.message.text && ctx.message.text.startsWith('/')) {
      return next();
    }

    // Skip if there's no text or button text is matched
    if (!ctx.message.text || (
      ['Подтвердить отправку ответа', 'Изменить ответ', 'Отказаться от обращения',
        'Задать вопрос', 'FAQ', 'Мои обращения', 'Назад', 'Подтвердить', 'Изменить', '❓ Помощь', 'Текущее обращение']
        .includes(ctx.message.text)
    )) {
      return next();
    }

    const studentState = studentHandlers.studentStates.get(ctx.from.id);

    if (studentState && studentState.state === 'writing_answer') {
      await studentHandlers.handleStudentAnswer(ctx);
    } else {
      return next();
    }
  } catch (error) {
    logError(error, { context: 'Student answer handler error', userId: ctx.from.id });
    return next();
  }
});

// Enhanced error handling
bot.catch((err, ctx) => {
  const errorContext = {
    updateType: ctx.updateType,
    userId: ctx.from ? ctx.from.id : null,
    username: ctx.from ? ctx.from.username : null,
    chatId: ctx.chat ? ctx.chat.id : null,
    messageId: ctx.message ? ctx.message.message_id : null
  };

  logError(err, errorContext);

  // Try to respond to user when error occurs
  try {
    ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз позже.');
  } catch (replyErr) {
    logError(replyErr, { context: 'Error sending error message to user' });
  }
});

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  logInfo(`Bot shutting down due to ${signal}...`);

  bot.stop(signal)
    .then(() => {
      logInfo(`Bot stopped successfully (${signal})`);
      process.exit(0);
    })
    .catch((err) => {
      logError(err, { context: `Error stopping bot on ${signal}` });
      process.exit(1);
    });
};

// Launch bot
bot.launch()
  .then(() => {
    logInfo('Bot started successfully', {
      nodeEnv: process.env.NODE_ENV || 'production',
      pid: process.pid
    });
  })
  .catch(err => {
    logError(err, { context: 'Bot startup failed' });
    process.exit(1);
  });

// Enable graceful stop
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));