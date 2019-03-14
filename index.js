// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// Import required packages
const path = require('path');
const restify = require('restify');


// Node.js utility library
const util = require('util')

// Read botFilePath, botFileSecret and DB information from .env file
// Note: Ensure you have a .env file and include botFilePath and botFileSecret.
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });



// Einbindung externer Datenbank
const { CosmosDbStorage } = require('botbuilder-azure');

// Import required bot services. See https://aka.ms/bot-services to learn more about the different parts of a bot.
const { BotFrameworkAdapter, ConversationState, UserState, MemoryStorage, AutoSaveStateMiddleware } = require('botbuilder');
// Import required bot configuration.
const { BotConfiguration } = require('botframework-config');
// Import Dialogs extension
const { DialogSet } = require('botbuilder-dialogs');
// Import typing indicator extension
const { ShowTyping } = require('botbuilder-toybox-extensions');

// Local browser storage
const memoryStorageLocal = new MemoryStorage();


//Add CosmosDB (greift auf Informationen in .env-Datei zu)
const memoryStorage = new CosmosDbStorage({
    serviceEndpoint: process.env.ACTUAL_SERVICE_ENDPOINT, 
    authKey: process.env.ACTUAL_AUTH_KEY, 
    databaseId: process.env.DATABASE,
    collectionId: process.env.COLLECTION
})

// ConversationState and UserState
const conversationState = new ConversationState(memoryStorageLocal);
const userState = new UserState(memoryStorageLocal);



// Create a dialog set for the bot.
const dialogStateAccessor = conversationState.createProperty('dialogState');
const dialogSet = new DialogSet(dialogStateAccessor);



// Create the bot.
const { MyBot } = require('./bot');
const bot = new MyBot(conversationState, userState, dialogSet, memoryStorage);




// Get the .bot file path
// See https://aka.ms/about-bot-file to learn more about .bot file its use and bot configuration.
const BOT_FILE = path.join(__dirname, (process.env.botFilePath || ''));
let botConfig;
try {
    // Read bot configuration from .bot file.
    botConfig = BotConfiguration.loadSync(BOT_FILE, process.env.botFileSecret);
} catch (err) {
    console.error(`\nError reading bot file. Please ensure you have valid botFilePath and botFileSecret set for your environment.`);
    console.error(`\n - The botFileSecret is available under appsettings for your Azure Bot Service bot.`);
    console.error(`\n - If you are running this bot locally, consider adding a .env file with botFilePath and botFileSecret.`);
    console.error(`\n - See https://aka.ms/about-bot-file to learn more about .bot file its use and bot configuration.\n\n`);
    process.exit();
}

// For local development configuration as defined in .bot file
const DEV_ENVIRONMENT = 'development';

// Define name of the endpoint configuration section from the .bot file
const BOT_CONFIGURATION = (process.env.NODE_ENV || DEV_ENVIRONMENT);

// Get bot endpoint configuration by service name
// Bot configuration as defined in .bot file
const endpointConfig = botConfig.findServiceByNameOrId(BOT_CONFIGURATION);

// Create HTTP server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function() {
    console.log(`\n${ server.name } listening to ${ server.url }`);
    console.log(`\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator`);
    console.log(`\nTo talk to your bot, open RoboAdvisorBot.bot file in the Emulator`);
});

// Create bot adapter.
// See https://aka.ms/about-bot-adapter to learn more about bot adapter.
const adapter = new BotFrameworkAdapter({
   appId: endpointConfig.appId || process.env.microsoftAppID,
   appPassword: endpointConfig.appPassword || process.env.microsoftAppPassword
});

// Scheinbar nötig für CosmosDB wirft bei local speicher aber error
adapter.use(new AutoSaveStateMiddleware(conversationState));
adapter.use(new AutoSaveStateMiddleware(userState));

// Typing middleware
//adapter.use(new ShowTyping());


// Catch-all for any unhandled errors in your bot.
adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    
    //console.error(`\n [onTurnError]: ${error}`);
    // Send a message to the user
    //context.sendActivity("error: " + error);
    context.sendActivity(util.inspect(error, false, null, false /* enable colors */));
    //context.sendActivity(`Oops. Something went wrong!`);
    
    /* // Clear out state
    await conversationState.load(context);
    await conversationState.clear(context);
    await userState.load(context);
    await userState.clear(context);
    // Save state changes.
    await conversationState.saveChanges(context);
    await userState.saveChanges(context); */
    await bot.onTurn(context)
    
};



// Listen for incoming activities and route them to your bot main dialog.
server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
    
        //Aufruf der Methode, die Text speichert
        //await logMessageText(memoryStorage, context);

          //  await logMessageText(memoryStorage, context, userState);

        // route to main dialog.
        await bot.onTurn(context);
    });
});

