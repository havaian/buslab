const User = require('../models/user');

const detectUserLanguage = async (ctx, next) => {
    try {
        let userLocale = 'ru'; // Default

        // Try to get user from database first
        if (ctx.from) {
            const user = await User.findOne({ telegramId: ctx.from.id });
            if (user && user.language) {
                userLocale = user.language;
            } else {
                // Detect from Telegram language_code
                const telegramLocale = ctx.from.language_code;

                if (telegramLocale) {
                    // Map Telegram locales to our supported locales
                    const localeMap = {
                        'ru': 'ru',
                        'uz': 'uz',
                        'en': 'en',
                        'kk': 'kk'
                    };

                    const detectedLocale = localeMap[telegramLocale.split('-')[0]];
                    if (detectedLocale) {
                        userLocale = detectedLocale;

                        // Save detected language to user profile
                        if (user) {
                            user.language = userLocale;
                            await user.save();
                        }
                    }
                }
            }
        }

        // Add locale to context
        ctx.locale = userLocale;

        return next();
    } catch (error) {
        console.error('Error in language detection middleware:', error);
        ctx.locale = 'ru'; // Fallback to Russian
        return next();
    }
};

module.exports = { detectUserLanguage };