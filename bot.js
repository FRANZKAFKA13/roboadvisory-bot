// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// bot.js is your bot's main entry point to handle incoming activities.

const { ActivityTypes, ActionTypes } = require('botbuilder');
const { NumberPrompt, ChoicePrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CardFactory } = require('botbuilder');
const { MessageFactory } = require('botbuilder');
const path = require('path');
const fs = require('fs');

// Compare strings based on Sørensen–Dice coefficient (https://www.npmjs.com/package/string-similarity-js)
const { stringSimilarity } = require('string-similarity-js');

// Node.js utility library
const util = require('util')

// Calculate Delay
const fleschKincaid = require('flesch-kincaid');
const syllable = require('syllable');


// The accessor names for the conversation data and user profile state property accessors.
const CONVERSATION_DATA_PROPERTY = 'conversationData';
const USER_DATA_PROPERTY = 'userData';

// Prompts
const NAME_PROMPT = "name_prompt";
const AGE_PROMPT = "age_prompt";
const GENDER_PROMPT = 'major_prompt';
const EDUCATION_PROMPT = 'education_prompt';
const CONFIRM_PROMPT = 'confirm_prompt';
const CONFIRM_PROMPT2 = 'confirm_prompt2';
const INDUSTRY_PROMPT = 'industry_prompt';
const FINISH_PROMPT = 'finish_prompt';
const MAINMENU_PROMPT = 'mainmenu_prompt';




// Import AdaptiveCard content
const riskCard = [];
for (var i = 1; i <= 10; ++i) {
    riskCard[i] = require('./resources/RiskCard' + i + '.json');
}
const factSheet = [];
for (var i = 0; i <= 2; ++i) {
    factSheet[i] = require('./resources/FactSheet' + i + '.json');
}


// Referencing the microsoft recognizer package (https://github.com/Microsoft/Recognizers-Text/tree/master/JavaScript/packages/recognizers-text-suite)
var Recognizers = require('@microsoft/recognizers-text-suite');
var NumberRecognizers = require('@microsoft/recognizers-text-number');
var NumberWithUnitRecognizers = require('@microsoft/recognizers-text-number-with-unit');
var DateTimeRecognizers = require('@microsoft/recognizers-text-date-time');
var SequenceRecognizers = require('@microsoft/recognizers-text-sequence');
var ChoiceRecognizers = require('@microsoft/recognizers-text-choice'); 


// Static data and functions for UserData assessment
const userData = {
    name: { 
        tag: "Name",
        prompt: "Wie heißt du?",
    },
    age: {
        tag: "Alter",
        prompt: "Wie alt bist du?",
        recognize: (step) => {
            let input = step.result.toString();
            let result = Recognizers.recognizeNumber(input, Recognizers.Culture.German);
            result = parseInt(result[0].resolution.value);
            return result;
        },
        validate: async (step) => {
            try {
                // Recognize the input as a number. This works for responses such as
                // "twelve" as well as "12".
                let input = step.result.toString();
                let result = Recognizers.recognizeNumber(input, Recognizers.Culture.German);
                let age = parseInt(result[0].resolution.value);
                if (age < 16) {
                    await step.context.sendActivity("Für die Teilnahme am Experiment musst du **16 Jahre oder älter** sein.");
                    return false;
                }
                if (age > 80 ) {
                    await step.context.sendActivity("Für die Teilnahme am Experiment musst du **80 Jahre oder jünger** sein.");
                    return false;
                }
            } catch (e) {
                if (treatment.selfReference == true) {
                    await step.context.sendActivity("Es tut mir leid, ich habe dein Alter leider nicht verstanden.");
                } else {
                    await step.context.sendActivity("Die Eingabe deines Alters wurde nicht erkannt.");
                }
                
                console.log("Fehlermeldung :" + e);
                return false;
            }
            return true;
        }
    },
    gender: {
        tag: "Geschlecht",
        prompt: "Was ist dein Geschlecht?",
    },
    education: {
        tag: "Höchster Bildungsabschluss",
        prompt: "Was ist dein höchster Bildungsabschluss?",
    },
}


// Object for education validation
const educations = {
    none: { 
        solution: "Kein Schulabschluss",
        possibilities: ['keinen', 'kein', 'kein abschluss'],
    },
    elementary: {
        solution: "Grund-/Hauptschulabschluss",
        possibilities: ['Grundschule', 'Hauptschule', 'Hauptschulabschluss', 'haupt',],
    },
    real: {
        solution: "Realschulabschluss",
        possibilities: ['real', 'realschule', 'realschulabschluss', 'mittlere reife', 'real'],
    },
    abi: {
        solution: "Abitur",
        possibilities: ['Abitur', 'abitur', 'abi', 'matura', 'allgemeinbildendes abitur', 'fachliches abitur', 'fachabi', 'gymi'],
    },
    bachelor: {
        solution: "Bachelor",
        possibilities: ['bachelor', 'Bachelor', 'bachelor of science', 'bachelor of arts', 'bachelor of engineering','B.Sc.', 'B. Sc.', 'b sc', 'b.sc.', 'bsc', 'b.sc'],
    },
    master: {
        solution: "Master",
        possibilities: ['master', 'Master', 'master of science', 'master of arts', 'master of engineering', 'M.Sc.', 'M. Sc.', 'm sc', 'm.sc.', 'msc', 'm.sc'],
    },
    diplom: {
        solution: "Diplom",
        possibilities: ['diplom', 'dipl.', 'dipl', 'diplom-', 'diplomgrad', 'diplomingenieur', 'dipl-ing.', 'diplom ing'],
    },
    staatsexamen: {
        solution: "Staatsexamen",
        possibilities: ['stex', 'erstes staatsexamen', '1. staatsexamen', 'zweites staatsexamen', '2. staatsexamen', 'erstes stex', 'zweites stex', '1. stex', '2. stex'],
    },
    phd: {
        solution: "Ph.D.",
        possibilities: ['doktor', 'dr.', 'promotion', 'phd', 'promoviert', 'dokter', 'dr'],
    },
}

// Objects for major validation
const majors = {
    wiwi: { 
        solution: "WING / INWI / TVWL",
        possibilities: ['wing', 'wirtschaftsingenieurwesen', 'wirtschaftsingenieur', 'wiwi', 'wing', 'tvwl', 'inwi', 'informationswirtschaft', 'technische vwl', 'technische volkswirtschaftslehre', 'wirting'],
    },
    maschinenbau: {
        solution: "Maschinenbau",
        possibilities: ['maschinenbau', 'maschbau'],
    },
    informatik: {
        solution: "Informatik",
        possibilities: ['info', 'informatik'],
    },
    mathe: {
        solution: "(Wirtschafts-)Mathematik",
        possibilities: ['mathe', 'mathematik', 'wima', 'Wirtschaftsmathe', 'Wirtschaftsmathematik'],
    },
    etec: {
        solution: "Elektrotechnik",
        possibilities: ['elektrotechnik', 'etec', 'etechnik', 'etech'],
    },
    physik: {
        solution: "Physik",
        possibilities: ['Physik', 'phys'],
    },
    archi: {
        solution: "Architektur",
        possibilities: ['Architektur', 'archi'],
    },
    sonstiges: {
        solution: "Sonstiges",
        possibilities: ['Sonstiges', 'sonstig', 'nicht dabei', 'anders'],
    },
}

// Objects for gender validation
const genders = {
    male: { 
        solution: "männlich",
        possibilities: ['männlich', 'männl', 'mann', 'junge', 'm', 'männlihc', 'mannlich', 'mannlihc'],
    },
    female: {
        solution: "weiblich",
        possibilities: ['weiblich', 'weibl', 'frau', 'mädchen', 'w', 'weiblihc'],
    },
    diverse: {
        solution: "divers",
        possibilities: ['divers'],
    },
}

// Objects for yes/no validation
const yesno = {
    yes: { 
        solution: "Ja",
        possibilities: ['jip', 'ok', 'okay', 'oki', 'oke', 'jib', 'jap', 'yep', 'ja', 'yes', 'jop', 'jupp', 'jup', 'klar', 'si', 'oui', 'klaro', 'jaha', 'jaa', 'ya', 'yup', 'yas', 'jo'],
    },
    no: {
        solution: "Nein",
        possibilities: ['nein', 'nö', 'nop', 'nope', 'no', 'auf keinen fall', 'ne', 'nee', 'niemals', 'nöp'],
    },
}


// Data for Investment decision
const investmentData = {
    companies: ["ACG GmbH", "Breen GmbH", "Plus GmbH"],
}

// Determines treatment
const treatment = {
    // Different cues on / off
    responseTimeFix: false,
    responseTimeVar: false,
    introduction: false,
    selfReference: false,
    civility: false,
    rememberName: false,
    initiation: true,
    smallTalk: false,
    apologizePraise: false,
    gender: false,
}

// Activates or deactivates the advisory dialog and payout dialog (split in experiment)
const advisoryDialog = false;
const payoutDialog = false;

// If this is activated, each dialog can be selected independently
const testing = false;

class MyBot {
    /**
     *
     * @param {ConversationState} conversation A ConversationState object used to store values specific to the conversation.
     * @param {userState} userState A UserState object used to store values specific to the user.
     */
    constructor(conversationState, userState, dialogSet, memoryStorage) {
        console.log("Constructor start");
        // Creates a new state accessor property.
        // See https://aka.ms/about-bot-state-accessors to learn more about the bot state and state accessors
        this.conversationState = conversationState;
        this.userState = userState;

        // Memory storage
        this.memoryStorage = memoryStorage;

        // Assign dialogSet
        this.dialogSet = dialogSet;

        // Conversation Data Property for ConversationState
        this.conversationDataAccessor = conversationState.createProperty(CONVERSATION_DATA_PROPERTY);

        // User Data Property for UserState
        this.userDataAccessor = this.userState.createProperty(USER_DATA_PROPERTY);

        // Add prompts that will be used in dialogs
        this.dialogSet
            .add(new TextPrompt(NAME_PROMPT))
            .add(new TextPrompt(AGE_PROMPT))
            .add(new TextPrompt(GENDER_PROMPT))
            .add(new TextPrompt(EDUCATION_PROMPT))
            .add(new TextPrompt(CONFIRM_PROMPT))
            .add(new TextPrompt(CONFIRM_PROMPT2))
            .add(new ChoicePrompt(INDUSTRY_PROMPT))
            .add(new ChoicePrompt(FINISH_PROMPT))
            .add(new ChoicePrompt(MAINMENU_PROMPT));

        // Welcome dialog
        this.dialogSet.add(new WaterfallDialog('welcome', [
            this.welcomeUser.bind(this),                
        ]));

        // Main Menu Dialog
        this.dialogSet.add(new WaterfallDialog('mainMenu', [
            async function (step) {
               // Return await step.prompt('choicePrompt', "Wähle eine der folgenden Optionen aus", ['Order Dinner', 'Reserve a table', 'Profil erstellen']);
               return await step.prompt(MAINMENU_PROMPT, "**Bitte wähle** eine der folgenden Optionen aus", ['Profil erstellen', 'Profil anzeigen', 'Profil löschen', 'Risikoverhalten', 'Investment']);
            },
            async function (step) {
                // Handle the user's response to the previous prompt and branch the dialog.
                if (step.result.value.match(/Profil erstellen/ig)) {
                    return await step.beginDialog('createProfile', userID);
                }
                if (step.result.value.match(/Profil anzeigen/ig)) {
                    return await step.beginDialog('displayProfile', userID);
                }
                if (step.result.value.match(/Profil löschen/ig)) {
                    return await step.beginDialog('deleteProfile', userID);
                }
                if (step.result.value.match(/Risikoverhalten/ig)) {
                    return await step.beginDialog('riskAssessment', userID);
                }
                if (step.result.value.match(/Investment/ig)) {
                    return await step.beginDialog('investmentDecision', userID);
                }
            },
            async function (step) {
                // Calling replaceDialog will loop the main menu
                return await step.replaceDialog('mainMenu', userID);
            }
        ]));

        // Create dialog for prompting user for profile data
        this.dialogSet.add(new WaterfallDialog('createProfile', [
            this.promptForName.bind(this),
            this.promptForAge.bind(this),
            this.promptForGender.bind(this),
            this.promptForEducation.bind(this),
           // this.promptForMajor.bind(this),
            this.completeProfile.bind(this)
        ]));

        // Create dialog for displaying saved profile to user
        this.dialogSet.add(new WaterfallDialog('displayProfile', [
            this.displayProfile.bind(this),
            this.isProfileCorrect.bind(this),
        ]));

        // Delete UserProfile
        this.dialogSet.add(new WaterfallDialog('deleteProfile', [
            this.deleteProfile.bind(this),
        ]));

        // Assess risk
        this.dialogSet.add(new WaterfallDialog('riskAssessment', [
            this.presentRiskCards.bind(this),
            this.assessRisk.bind(this),
        ]));

        // Investment Dialog
        this.dialogSet.add(new WaterfallDialog('investmentDecision', [
            this.promptForIndustry.bind(this),
            this.sendInstructions.bind(this),
            this.furtherInformation.bind(this),
            this.presentCompanyInfo.bind(this),
            this.recommendInvestment.bind(this),
            this.captureInvestmentDecision.bind(this),
            this.saveInvestmentDecision.bind(this),
            this.finishAdvisory.bind(this),
        ]));

        // Investment result dialog
        this.dialogSet.add(new WaterfallDialog('investmentResult', [
            this.prepareStockPrep.bind(this),
            this.presentStock.bind(this),
            this.presentPayout.bind(this),
        ]))

        // Enddialog
        this.dialogSet.add(new WaterfallDialog('endDialog', [
            this.end.bind(this),
            this.loopEnd.bind(this)
        ]));

        // Create dialog for displaying payout to the user
        this.dialogSet.add(new WaterfallDialog('displayPayout', [
            this.displayPayout.bind(this),
        ]));

        // Create dialog starting bot via command
        this.dialogSet.add(new WaterfallDialog('startBot', [
            this.startBot.bind(this),
            this.startDialog.bind(this),
        ]));

        console.log("Constructor end");

    } // End of constructor

    // Function for welcoming user
    async welcomeUser (step) {
        console.log("Welcome User Dialog");

        // Get userId from onTurn()
        const userID = step.options;
        
        // Get conversation- and userData from bot state
        const conversationData = await this.conversationDataAccessor.get(step.context, {});
        const user = await this.userDataAccessor.get(step.context, {});
        
        console.log("User in welcome dialog");
        console.log(util.inspect(user, false, null, false ));

        console.log("conversationData from Middleware");
        console.log(util.inspect(conversationData, false, null, false ));
        
        // Write user and conversationdata to state
        await this.userDataAccessor.set(step.context, user);
        await this.conversationDataAccessor.set(step.context, conversationData);
                           
        // Welcome the user
        if (treatment.introduction == true && treatment.rememberName == true && treatment.gender == true) {
            await sendWithDelay("Hallo und herzlich willkommen, ich bin **Charles**, dein persönlicher **Investmentberater**. Ich begleite dich durch den Beratungsprozess.", step);
        } else if (treatment.introduction == true && treatment.gender == false) {
            let msg = "Hallo und herzlich willkommen, ich bin ein **Robo-Advisor**. Ich begleite dich durch den Beratungsprozess.";
            await sendWithDelay(msg, step);
        } else if (treatment.introduction == false && treatment.selfReference == false && treatment.rememberName == false) {
            let msg = "Du wirst nun durch den Beratungsprozess begleitet.";
            await sendWithDelay(msg, step);
        }

        // Check if bot in testmode and route to dialogs
        if (testing == true) {
            // Start main dialog
            return await step.beginDialog('mainMenu', userID);
        } else {
            // Start Profilecreation
            return await step.beginDialog('createProfile', userID);
        }
    }

    // Functions for creating UserProfile 
        async promptForName (step) {
            console.log("Name Prompt");

            // Get userID from prior step and clear changes
            const userID = step.options;
            
            // Read UserData from State
            const user = await this.userDataAccessor.get(step.context, {});
            const conversationData = await this.conversationDataAccessor.get(step.context, {});
            
            // Save User- and Conversationdata to State
            await this.userDataAccessor.set(step.context, user);
            await this.conversationDataAccessor.set(step.context, conversationData);

            // Before prompting, check if value already exists
            if(!user.name){
                if (user.deleted == true) {
                        
                        if (treatment.selfReference == true) {
                            let msg = "Ich stelle dir nun die gleichen Fragen erneut.";
                            await sendWithDelay(msg, step);
                        } else {
                            let msg = "Im Folgenden nochmal die gleichen Fragen.";
                            await sendWithDelay(msg, step);
                        }
                } else if (!conversationData.wrongName) {
                        if (treatment.selfReference == true) {
                            let msg = "Ich stelle dir nun ein paar Fragen, um deine wichtigsten Daten zu erfassen.";
                            await sendWithDelay(msg, step);
                        } else {
                            let msg = "Im Folgenden ein paar Fragen, um deine wichtigsten Daten zu erfassen.";
                            await sendWithDelay(msg, step);
                        }
                        
                }
                // Username doesn't exist --> Prompt
                await delay(userData.name.prompt, step).then(async function() { 
                    return await step.prompt(NAME_PROMPT, userData.name.prompt);
                });
            } else {
                return await step.next();
            }
        }

        async promptForAge (step) {
            console.log("Age Prompt");

            // Get userID from prior step and clear changes
            const userID = step.options;

            // Get UserData and conversationdata from State
            const user = await this.userDataAccessor.get(step.context, {});
            const conversationData = await this.conversationDataAccessor.get(step.context, {});
            
            console.log("User in age dialog");
            console.log(util.inspect(user, false, null, false ));
                        
            // Before saving entry, check if it already exists
            if(!user.name) {

                // Check if user entered whole sentence instead of name
                var spaceCount = (step.result.split(" ").length - 1);

                if (spaceCount > 1) {
                    if (treatment.civility == true) {
                        let msg = `Bitte gib nur deinen Namen ein.`;
                        await sendWithDelay(msg, step);
                    } else {
                        let msg = `Gib nur deinen Namen ein.`;
                        await sendWithDelay(msg, step);
                    }
                    conversationData.wrongName = true;
                    await this.conversationDataAccessor.set(step.context, conversationData);
                    return await step.replaceDialog('createProfile', userID);
                }

                user.name = step.result;
                                
                // Write userData to State
                await this.userDataAccessor.set(step.context, user);             

                // Notify user about his name being remembered
                if (treatment.rememberName == true) {
                    let msg = `Hallo **${user.name}**! Danke, dass du mir deinen Namen verraten hast. Ich werde ihn mir ab jetzt merken.`;
                    await sendWithDelay(msg, step);
                }
            }
            // Before prompting, check if value already exists
            if(!user.age) {
                await delay(userData.age.prompt, step).then(async function() { 
                    return await step.prompt(AGE_PROMPT, userData.age.prompt);
                });
                
            } else {
                return await step.next();
            }
        }

        async promptForGender (step) {
            console.log("Gender Prompt");

            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            console.log("User in Gender dialog");
            console.log(util.inspect(user, false, null, false ))

            // Before saving entry, check if it already exists
            if(!user.age){
                // Validate entered age
                let validated = await userData.age.validate(step)
                if (validated){
                    user.age = userData.age.recognize(step);
                    
                await this.userDataAccessor.set(step.context, user);

                } else if (!validated) {
                    // Prompt for age again
                    return await step.replaceDialog("createProfile", userID);
                }
            } 
            // Before prompting, check if value already exists
            if(!user.gender){
                // Call Gender Prompt
                await delay(userData.gender.prompt, step).then(async function() { 
                    return await step.prompt(GENDER_PROMPT, userData.gender.prompt);
                });
                
            } else {
                return await step.next();
            }
        }
        async promptForEducation (step) {
            console.log("Education Prompt");
           
            // Get userID from prior step and clear changes
            const userID = step.options;


            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            console.log("User in education dialog nach pull");
            console.log(util.inspect(user, false, null, false ))

            // Before saving entry, check if it already exists
            if(!user.gender){
                var validation = await validateInput(step.result, genders);
                if (validation) {
                    user.gender = validation;
                } else {
                    if(treatment.selfReference == true) { var msg = "Sorry, das habe ich nicht verstanden. Bitte versuche es erneut." }
                    else { var msg = "Die Eingabe wurde nicht erkannt. Versuche es erneut."}
                    await sendWithDelay(msg, step);
                    return await step.replaceDialog('createProfile', userID);
                }
                
                // Write userData to DB
                await this.userDataAccessor.set(step.context, user);
            }
            // Before prompting, check if value already exists
            if (!user.education) {

                // Prompt for highest education with list of education options
                await delay(userData.education.prompt, step).then(async function() { 
                    return await step.prompt(EDUCATION_PROMPT, userData.education.prompt);
                });
            } else {
                return await step.next();
            }
        }
       /*  async promptForMajor (step) {
            console.log("Major Prompt");

            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            // Before saving entry, check if it already exists
            if(!user.education){
                var validation = await validateInput(step.result, educations);
                if (validation) {
                    user.education = validation;
                } else {
                    if(treatment.selfReference == true) { var msg = "Sorry, das habe ich nicht verstanden. Bitte versuche es erneut." }
                    else { var msg = "Die Eingabe wurde nicht erkannt. Versuche es erneut."}
                    await sendWithDelay(msg, step);

                    return await step.replaceDialog('createProfile', userID);
                }
                
                // Write userData to DB
                await this.userDataAccessor.set(step.context, user);
            }
            // Before prompting, check if value already exists
            if (!user.major){
                await delay(userData.major.prompt, step).then(async function() { 
                    return await step.prompt('textPrompt', userData.major.prompt);
                });
            } else {
                return await step.next();
            }
        } */
        
        async completeProfile (step) {
            console.log("Complete");
            
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});
            

            // Before saving entry, check if it already exists
            if(!user.education){
                var validation = await validateInput(step.result, educations);
                if (validation) {
                    user.education = validation;
                } else {
                    if(treatment.selfReference == true) { var msg = "Sorry, das habe ich nicht verstanden. Bitte versuche es erneut." }
                    else { var msg = "Die Eingabe wurde nicht erkannt. Versuche es erneut."}
                    await sendWithDelay(msg, step);

                    return await step.replaceDialog('createProfile', userID);
                }

                
                
                // Write userData to DB
                await this.userDataAccessor.set(step.context, user);
            }

            
            if (!user.complete){
                // Read UserData from DB
                const user = await this.userDataAccessor.get(step.context, {});
                // Set user to complete
                user.complete = true;

                // Save conversation ID
                user.advisoryConversationId = step.context.activity.conversation.id;

                // Save userID to User
                user.userID = userID;

                

                // Write userData to DB
                await this.userDataAccessor.set(step.context, user);

                if (treatment.rememberName == true) {
                    var msg = `Super **${user.name}**, dein Profil ist nun vollständig. Danke für deine Mitarbeit.`;
                } else {
                    var msg = `Super, dein Profil ist nun vollständig.`;
                }
                await sendWithDelay(msg, step);
            } else {
                let msg = `**${user.name}**, du hast dein Profil bereits ausgefüllt.`;
                await sendWithDelay(msg, step);
            }
            if (testing == true) {
                // Return to main dialog                
                return await step.beginDialog('mainMenu', userID);
            } else {
                return await step.beginDialog('displayProfile', userID);
            }
        }

        // Function for displaying user profile
        async displayProfile (step) {
            console.log("Display Profile");
            
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Get UserData and ConversationData objects
            const user = await this.userDataAccessor.get(step.context, {});
            const conversationData = await this.conversationDataAccessor.get(step.context, {});

            conversationData.display = {
                value: "",
            }
            

            // If Profile not completed, end dialog and return to main menu
            if (!user.complete){
                let msg = "Dein Profil ist noch nicht vollständig.";
                await sendWithDelay(msg, step);
                return await step.replaceDialog('createProfile', userID);
            }

            // Create array from individual user data
            conversationData.userArr = Object.values(user);
            var i = 0;
            // Iterate through user data and create string
            Object.keys(userData).forEach(function(key) {
                console.log(conversationData.userArr[i]);
                conversationData.display.value = "" + conversationData.display.value  + "**" + userData[key].tag + "**" + ': ' + conversationData.userArr[i].toString() + '\n';
                i++;
            })

            // Replace undefined with ""
            conversationData.display.value = conversationData.display.value.replace(/undefined/g, "");
            // Display profile to user
            var msg = "Das sind deine Profildaten:";
            await sendWithDelay(msg, step);
            var msg = conversationData.display.value;
            await sendWithDelay(msg, step);
            // Clear display string
            conversationData.display.value = "";

            // Prompt user, if profile is correct
            await delay("Sind deine Daten korrekt?", step).then(async function() { 
                return await step.prompt(CONFIRM_PROMPT, "Sind deine Daten korrekt?");
            });
        }
        async isProfileCorrect (step) {

            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            try {
                var validation = await validateInput(step.result, yesno);
            }
            catch (e) {console.log(e)}

            console.log(validation);
            try {
                if (!validation) {
                    if(treatment.selfReference == true) { var msg = "Sorry, das habe ich nicht verstanden." }
                    else { var msg = "Die Eingabe wurde nicht erkannt."}
                    await sendWithDelay(msg, step);
                    return await step.replaceDialog('displayProfile', userID);
                }
            }
            catch (e) {await step.context.sendActivity(e)}
            try {
                // If profile incorrect, delete profile and recreate
                if (validation.localeCompare("Nein") == 0) {                    
                    return await step.replaceDialog('deleteProfile', userID);
                }
            }
            catch (e) {console.log(e)}

            // Loop main menu or go to next dialog (depending on test mode)
            if (testing == true) {
                // Return to main dialog                
                return await step.beginDialog('mainMenu', userID);
            } else {
                return await step.beginDialog('riskAssessment', userID);               
            }
        }

        // Function for deleting user profile
        async deleteProfile (step) {
            console.log("Delete Profile");
            
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});


            // Iterate through user data and delete entries
            /* Object.keys(user).forEach(function(key) {
                user[key] = "";
            }) */
            user.name = "";
            user.age = "";
            user.gender = "";
            user.education = "";

            // Clear "complete" Tag
            user.complete = false;
            user.deleted = true;

            // Write userData to DB
            await this.userDataAccessor.set(step.context, user);

            // End dialog
            var msg = "Dein Profil wurde gelöscht."
            await sendWithDelay(msg, step);
            
            // Loop main menu or go to next dialog (depending on test mode)
            if (testing == true) {
                // Return to main dialog                
                return await step.beginDialog('mainMenu', userID);
            } else {
                // Recreate profile
                return await step.beginDialog('createProfile', userID);
            }
        }



        // Functions for Risk Assessment

        async presentRiskCards (step) {

            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});
            console.log("User bei risk card presentation")
            console.log(util.inspect(user, false, null, false ));
            

            // Überprüfen, ob Spiel bereits läuft, falls nicht, neue Runde starten 
            if (!user.roundCounter) {

                try {
                    user.roundCounter = 1;
                }
                catch (e) { }
                if (treatment.selfReference == true) {
                    var msg = "Bevor wir uns deinem Investmentportfolio widmen, werde ich zunächst **dein Risikoverhalten** ermitteln."
                } else {
                    var msg = "Bevor dein Investmentportfolio erstellt wird, wird zunächst **dein Risikoverhalten** ermittelt."
                }
                await sendWithDelay(msg, step);

                if (treatment.selfReference == true) {
                    var msg = "Um dein Risikoverhalten zu analysieren, werde ich ein kleines Spiel mit dir spielen.";
                } else {
                    var msg = "Dein Risikoverhalten wird mit Hilfe eines kleinen Spiels analysiert.";
                }
                await sendWithDelay(msg, step);
                

                if (treatment.selfReference == true) {
                    var msg = "Ich präsentiere dir nun bis zu zehn mal hintereinander zwei Lotteriespiele, von denen du dich bitte **jeweils für eines entscheidest**.";
                } else {
                    var msg = "Dir werden nun bis zu zehn mal hintereinander zwei Lotteriespiele präsentiert, von denen du dich **jeweils für eines entscheiden** musst.";
                }
                await sendWithDelay(msg, step);
  
                var msg = "Jedes Spiel hat zwei mögliche Ausgänge, die jeweils eine festgelegte Wahrscheinlichkeit und \
                eine festgelegte Auszahlung in Geldeinheiten (GE) haben.";
                await sendWithDelay(msg, step);               
            }
            
            
            // If RiskAssessment already finished, notify user and go back to main menu
            if (user.riskAssessmentComplete == true) {
                var msg = `Dein Risikoverhalten wurde bereits ermittelt. Du bist **${user.riskDescription}**.`;
                await sendWithDelay(msg, step);
                if (testing == true) {
                    // Return to main dialog                
                    return await step.beginDialog('mainMenu', userID);
                } else {
                    return await step.beginDialog('investmentDecision', userID);
                }
                // Only present card, if round is not a repeated round
            } else if (user.riskrepeat == true){
                user.riskrepeat = false;
            } else {
                // Present Adaptive Card 1-10 for gathering User Input
                await step.context.sendActivity({
                    text: `Runde  ${user.roundCounter}`,
                    attachments: [CardFactory.adaptiveCard(riskCard[user.roundCounter])]
                });
            }
            
            // Write userData to DB
            await this.userDataAccessor.set(step.context, user);
        }

        async assessRisk (step) {
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData and conversationdata from state
            const user = await this.userDataAccessor.get(step.context, {});
            const conversationData = await this.conversationDataAccessor.get(step.context, {});
            
            
            // If user types in message, restart without iterating round counter
            if (step.result) {
                if (treatment.civility == true) {
                    var msg = "Bitte **triff deine Auswahl** und klicke auf **OK**. Bitte nutze dafür nicht den Chat.";
                } else {
                    var msg = "**Triff deine Auswahl** und klicke auf **OK**. Nutze dafür nicht den Chat.";
                }
                
                await sendWithDelay(msg, step);
                // Set repeat flag 
                user.riskrepeat = true;
                // Dialog abbrechen und Schritt wiederholen
                return await step.replaceDialog('riskAssessment', userID);
            }

            // Retrieve choice object from Adaptive JSON Card
            conversationData.choice = step.context.activity.value;

                        
            // Key extrahieren, Nummer abschneiden und in Zahl umwandeln (Welche Karte wurde benutzt?)
            conversationData.roundPlayed = Object.keys(conversationData.choice)[0];
            // If user doesn't make a choice, restart without iterating round counter
            if (!conversationData.roundPlayed) {
                if (treatment.civility == true) {
                    var msg = "Bitte **triff deine Auswahl** und klicke auf **OK**.";
                } else {
                    var msg = "**Triff deine Auswahl** und klicke auf **OK**.";
                }
                
                await sendWithDelay(msg, step);
                // Set repeat flag 
                user.riskrepeat = true;
                // Dialog abbrechen und Schritt wiederholen
                return await step.replaceDialog('riskAssessment', userID);
            } else {
                conversationData.roundPlayed = parseInt(conversationData.roundPlayed.substr(6,conversationData.roundPlayed.length));
            }
            
            console.log("Round counter bei Risk");
            console.log(user.roundCounter);

            // Überprüfen, ob Nutzer eine bereits verwendete Karte benutzt
            if (conversationData.roundPlayed < user.roundCounter) {
                if (treatment.civility == true) {
                    var msg = `Für Runde ${conversationData.roundPlayed} hast du bereits eine Wahl getroffen, bitte neuste Runde spielen.`;
                } else {
                    var msg = `Für Runde ${conversationData.roundPlayed} hast du bereits eine Wahl getroffen. Spiel die neuste Runde.`;
                }
                await sendWithDelay(msg, step);

                // Set repeat flag 
                user.riskrepeat = true;
                // Dialog abbrechen und Schritt wiederholen
                return await step.replaceDialog('riskAssessment', userID);
            // Case-Switch nötig, da JSON Cards Output statisch zurückgeben und eine Unterscheidung zwischen den Returns der Karten nötig ist (choice1-10)
            } else {
                switch (user.roundCounter) {
                    case 1:
                        conversationData.choice = conversationData.choice.choice1;
                        break;
                    case 2:
                        conversationData.choice = conversationData.choice.choice2;
                        break;
                    case 3:
                        conversationData.choice = conversationData.choice.choice3;
                        break;
                    case 4:
                        conversationData.choice = conversationData.choice.choice4;
                        break;      
                    case 5:
                        conversationData.choice = conversationData.choice.choice5;
                        break; 
                    case 6:
                        conversationData.choice = conversationData.choice.choice6;
                        break; 
                    case 7:
                        conversationData.choice = conversationData.choice.choice7;
                        break; 
                    case 8:
                        conversationData.choice = conversationData.choice.choice8;
                        break; 
                    case 9:
                        conversationData.choice = conversationData.choice.choice9;
                        break; 
                    case 10:
                        conversationData.choice = conversationData.choice.choice10;
                        break; 
                }
                
            }

            // If user didn't make choice, reprompt
            if (conversationData.choice.localeCompare("Bitte wählen") == 0) {
                if (treatment.civility == true) {
                    var msg = "Du hast keine eindeutige Wahl getroffen. Bitte erneut wählen.";
                } else {
                    var msg = "Du hast keine eindeutige Wahl getroffen. Wähle erneut.";
                }
                await sendWithDelay(msg, step);

                // Set repeat flag 
                user.riskrepeat = true;
                // Dialog abbrechen und Schritt wiederholen
                return await step.replaceDialog('riskAssessment', userID);
            }
            // Save choice
            if (!user.riskchoices) {
                // Create array if it doesn't exist yet
                user.riskchoices = [];
                user.riskchoices.push(conversationData.choice);
            } else {
                user.riskchoices.push(conversationData.choice);
            }
            // Make choice transparent for user
            await step.context.sendActivity(`Du hast dich in **Runde ${conversationData.roundPlayed}** für **Spiel ${conversationData.choice}** entschieden.`);
            

           
            // Repeat until all games are played or until B is played
            if (user.roundCounter < 10 && !conversationData.choice.localeCompare("A")) { // risk assessment continues
                user.roundCounter++;

                // Write userData to DB
                await this.userDataAccessor.set(step.context, user);

                // Start next round
                return await step.replaceDialog('riskAssessment', userID);
            } else { //risk assessment complete
                // Tag risk assessment as complete
                user.riskAssessmentComplete = true;
                // Assess risk behavior based on Holt and Laury (2002)
                // How many safe choices (A) were made by the user?
                conversationData.safeChoices = conversationData.roundPlayed - 1;
                switch (conversationData.safeChoices) {
                    case 0:
                        user.riskDescription = "höchst risikoliebend";
                        break;
                    case 1:
                        user.riskDescription = "höchst risikoliebend";
                        break;
                    case 2:
                        user.riskDescription = "sehr risikoliebend";
                        break;
                    case 3:
                        user.riskDescription = "risikoliebend";
                        break;
                    case 4:
                        user.riskDescription = "risikoneutral";
                        break;      
                    case 5:
                        user.riskDescription = "leicht risikoavers";
                        break; 
                    case 6:
                        user.riskDescription = "risikoavers";
                        break; 
                    case 7:
                        user.riskDescription = "sehr risikoavers";
                        break; 
                    case 8:
                        user.riskDescription = "höchst risikoavers";
                        break; 
                    case 9:
                        user.riskDescription = "bleib besser im Bett";
                        break; 
                    case 10:
                        user.riskDescription = "bleib besser im Bett";
                        break; 
                }

                // Fill choices array with "B" choices in order to make arrays equally long --> less data cleansing in Excel
                for (var i = 0; i < 10; i++) {
                    if (typeof user.riskchoices[i] === 'undefined') {
                        user.riskchoices[i] = "B";
                    }
                }

                // Write userData to state
                await this.userDataAccessor.set(step.context, user);

                // End dialog
                if (treatment.selfReference == true && treatment.rememberName == true && treatment.civility == true) {
                    var msg = `Vielen Dank ${user.name}, **ich habe dein Risikoverhalten nun analysiert**. Die verbale Bezeichnung deines Risikoverhaltens lautet: **${user.riskDescription}**.`; 
                } else {
                    var msg = `**Dein Risikoverhalten wurde nun analysiert**. Die verbale Bezeichnung deines Risikoverhaltens lautet: **${user.riskDescription}**.`;
                }
                await sendWithDelay(msg, step);

                // Loop main menu or go to next dialog (depending on test mode)
                if (testing == true) {
                    // Return to main dialog                
                    return await step.beginDialog('mainMenu', userID);
                } else {
                    return await step.beginDialog('investmentDecision', userID);
                }
            }
        }


        // Functions for Investment Game
        async promptForIndustry (step) {
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            // Get conversationData Object
            const conversationData = await this.conversationDataAccessor.get(step.context, {});

            // Skip this step if user already made an invalid choice at the end of this dialog
            if (conversationData.invalidChoice == true) {
                console.log("invalid choice entdeckt");
                return await step.next();
            }

            if (user.choice) {
                var msg = `Du hast dich bereits für das Unternehmen **${user.choice}** entschieden. `;
                await sendWithDelay(msg, step);
                return await step.replaceDialog('endDialog', userID);
            }
            
            if (!conversationData.repeatInvestmentDialog){
                if (treatment.selfReference == true){
                    var msg = "Da nun alle von dir relevanten Daten erfasst sind und dein Risikoprofil ermittelt ist, können wir uns zusammen um deine **Investitionsentscheidung** kümmern. Du hast ein Budget von **3000 Geldeinheiten** zur Verfügung.";
                } else {
                    var msg = "Da nun alle von dir relevanten Daten erfasst sind und dein Risikoprofil ermittelt ist, kommt als nächster Schritt die **Investitionsentscheidung**. Du hast ein Budget von **3000 Geldeinheiten** zur Verfügung.";
                }
                
                await sendWithDelay(msg, step);

            }
            await delay("In welcher Branche möchtest du dein Investment tätigen?", step).then(async function() { 
                return await step.prompt(INDUSTRY_PROMPT, "In welcher Branche möchtest du dein Investment tätigen?", ['Automobilindustrie', 'Halbleiterindustrie', 'Gesundheitsbranche', 'Andere Branche']); 
            });
            
        }
        async sendInstructions (step) {
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            // Get conversationData Object
            const conversationData = await this.conversationDataAccessor.get(step.context, {});

            // Skip this step if user already made an invalid choice at the end of this dialog
            if (conversationData.invalidChoice == true) {
                return await step.next();
            }

            // Reprompt if user doesn't choose appropriate industry from experiment's scenario description
            if (step.result.value.localeCompare("Halbleiterindustrie") != 0) {
                if (treatment.selfReference == true) {
                    var msg = `Entschuldigung, ${user.name}, diese Funktion ist leider zum aktuellen Zeitpunkt noch nicht verfügbar. Bitte entscheide dich für eine andere Branche.`;
                } else {
                    var msg = `Diese Funktion ist zum aktuellen Zeitpunkt nicht verfügbar. Entscheide dich für eine andere Branche.`;
                }
                await sendWithDelay(msg, step);

                conversationData.repeatInvestmentDialog = true;

                // Write to state
                await this.userDataAccessor.set(step.context, user);
                await this.conversationDataAccessor.set(step.context, conversationData);

                // Loop dialog
                return await step.replaceDialog('investmentDecision', userID);
            }

            // Send instructions and ask if user understood
            if (treatment.selfReference == true) {
                var msg = "Wir werden nun deinem Ziel nachkommen, dein Investitionsportfolio um eine Investition in der **Halbleiterindustrie** zu erweitern.";
            } else {
                var msg = "Du hast nun die Möglichkeit, dein Investitionsportfolio um eine Investition in der **Halbleiterindustrie** zu erweitern.";
            }
            await sendWithDelay(msg, step);

            if (treatment.selfReference == true) {
                var msg = "Um dir Arbeit zu ersparen, habe ich die drei vielversprechendsten Unternehmen der Branche **vorselektiert**. Ich werde dir gleich die wichtigsten Informationen zu den drei Unternehmen zukommen lassen, um dir eine Entscheidungsgrundlage zu geben.";
            } else {
                var msg = "Um dir Arbeit zu ersparen, wurden die drei vielversprechendsten Unternehmen der Branche **vorselektiert**. Dir werden gleich die wichtigsten Informationen zu den drei Unternehmen angezeigt, die dir als Entscheidungsgrundlage dienen.";
            }
            await sendWithDelay(msg, step);

            if (treatment.selfReference == true) {
                var msg = "Anschließend werde ich dir eine **Empfehlung** geben, die auf deinem Risikoprofil und meiner Einschätzung der Unternehmen basiert.";
            } else {
                var msg = "Anschließend bekommst du eine **Empfehlung**, die auf deinem Risikoprofil und der systemeigenen Einschätzung der Unternehmen basiert.";
            }
            
            await sendWithDelay(msg, step);

            await delay("Hast du alles verstanden?", step).then(async function() { 
                return await step.prompt(CONFIRM_PROMPT, "Hast du alles verstanden?");
            });

        }
        async furtherInformation (step) {
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            // Get conversationData Object
            const conversationData = await this.conversationDataAccessor.get(step.context, {});

            // Skip this step if user already made an invalid choice at the end of this dialog
            if (conversationData.invalidChoice == true) {
                return await step.next();
            }

            conversationData.validation = await validateInput(step.result, yesno);

            // If user didn't say "Yes", count it as "No"
            if (!conversationData.validation) {
                conversationData.validation = "Nein";
            }

            // Does user ask for further information?
            if (conversationData.validation.localeCompare("Nein") == 0) {
                if (treatment.selfReference == true) {
                    var msg = "Tut mir leid, dass ich mich nicht eindeutig ausgedrückt habe. Ich werde versuchen, es noch ein wenig besser zu erklären.";
                    await sendWithDelay(msg, step);
                    var msg = "Ich präsentiere dir gleich drei Faktenblätter zu den vorselektierten Unternehmen. Du kannst dir dann selbst ein Bild der Unternehmen machen.";
                    await sendWithDelay(msg, step);
                    var msg = "Anschließend gebe ich dir eine Empfehlung, in welches Unternehmen ich an deiner Stelle investieren würde. Ob du dieser Entscheidung folgst, bleibt dir überlassen.";
                    await sendWithDelay(msg, step);
                    await delay("Bereit für die Unternehmensdaten?", step).then(async function() { 
                        return await step.prompt(CONFIRM_PROMPT, "Bereit für die Unternehmensdaten?");
                    });
                } else {
                    var msg = "Hier erneut ein paar Informationen zu deinem besseren Verständnis.";
                    await sendWithDelay(msg, step);
                    var msg = "Dir werden nun drei Faktenblätter zu den vorselektierten Unternehmen präsentiert. Du kannst dir dann selbst ein Bild der Unternehmen machen.";
                    await sendWithDelay(msg, step);
                    var msg = "Anschließend bekommst du eine Empfehlung, in welches Unternehmen du laut dem Robo-Advisory System investieren solltest. Ob du dieser Entscheidung folgst, bleibt dir überlassen.";
                    await sendWithDelay(msg, step);
                    await delay("Bereit für die Unternehmensdaten?", step).then(async function() { 
                        return await step.prompt(CONFIRM_PROMPT, "Bereit für die Unternehmensdaten?");
                    });
                }               
            } else {
                // Skip this dialog
                return await step.next();
            }
        }
        async presentCompanyInfo (step) {
            /// Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            // Get conversationData Object
            const conversationData = await this.conversationDataAccessor.get(step.context, {});

            // Skip this step if user already made an invalid choice at the end of this dialog
            if (conversationData.invalidChoice == true) {
                return await step.next();
            }

            // Create array if it doesn't exist yet
            if (!user.order) {
                user.order = [];
            }

            // Create random order and save order to investmentData
            conversationData.arr = ["0", "1", "2"];
            for (var i = 1; i <= 3; i++){
                user.order.push(conversationData.arr.splice(Math.floor(Math.random() * conversationData.arr.length), 1)[0]);
            }

            // Present Adaptive cards in a carousel in random order
            conversationData.messageWithCarouselOfCards = MessageFactory.carousel([
                CardFactory.adaptiveCard(factSheet[user.order[0]]),
                CardFactory.adaptiveCard(factSheet[user.order[1]]),
                CardFactory.adaptiveCard(factSheet[user.order[2]]),
            ],"Hier die Unternehmensdaten. Nimm dir ausreichend Zeit, diese zu lesen. \n T GE steht für tausend Geldeinheiten.");
            await step.context.sendActivity(conversationData.messageWithCarouselOfCards);

            // Write userData to DB
            await this.userDataAccessor.set(step.context, user);

            // Ask user for any input to continue with next dialog
            if (treatment.selfReference == true) {
                var msg = "Bitte melde dich, wenn du alles gelesen hast, und wir mit meiner Empfehlung fortfahren können.";
                await sendWithDelay(msg, step);
            } else {
                var msg = "Melde dich, wenn du alles gelesen hast, und du bereit für die Empfehlung des Robo-Advisory Systems bist.";
                await sendWithDelay(msg, step);
                
            }
            
        }
        async recommendInvestment (step) {
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            // Get conversationData Object
            const conversationData = await this.conversationDataAccessor.get(step.context, {});

            // Skip this step if user already made an invalid choice at the end of this dialog
            if (conversationData.invalidChoice == true) {
                return await step.next();
            }

            // Make randomized recommendation 
            if (treatment.selfReference == true) {
                var msg = `Basierend auf meinen vergangenen Erfahrungen und aktuellen Marktanalysen halte ich \
                sowohl die **${investmentData.companies[user.order[0]]}** als auch die **${investmentData.companies[user.order[2]]}** für **überbewertet**. \
                Die **${investmentData.companies[user.order[1]]}** halte ich dagegen für **unterbewertet**. \
                Das Ergebnis deiner **Risikoverhaltensanalyse** passt außerdem zum Unternehmensprofil der **${investmentData.companies[user.order[1]]}**. Aufgrund dessen \
                empfehle ich dir, in die **${investmentData.companies[user.order[1]]}** zu investieren.`;
                await sendWithDelay(msg, step);
            } else {
                var msg = `Basierend auf vergangenen Erfahrungen und aktuellen Marktanalysen wird \
                sowohl die **${investmentData.companies[user.order[0]]}** als auch die **${investmentData.companies[user.order[2]]}** für **überbewertet** gehalten. \
                Die **${investmentData.companies[user.order[1]]}** wird als **unterbewertet** eingestuft. \
                Das Ergebnis deiner **Risikoverhaltensanalyse** passt außerdem zum Unternehmensprofil der **${investmentData.companies[user.order[1]]}**. Aufgrund dessen \
                wird dir vom Robo-Advisory System empfohlen, in die **${investmentData.companies[user.order[1]]}** zu investieren.`;
                await sendWithDelay(msg, step);
            }

            // Save recommendation
            user.botRecommendation = investmentData.companies[user.order[1]];

            // Write userData to DB
            await this.userDataAccessor.set(step.context, user);

            // Continue to next dialog step
            return await step.next();
        }
        async captureInvestmentDecision (step) {
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            // Get conversationData Object
            const conversationData = await this.conversationDataAccessor.get(step.context, {});

            // Skip this step if user already made an invalid choice at the end of this dialog
            if (conversationData.invalidChoice == true && treatment.civility == true) {
                var msg = "Bitte wähle eines der drei Unternehmen.";
                await sendWithDelay(msg, step);
            } else if (conversationData.invalidChoice == true && treatment.civility == false) {
                var msg = "Wähle eines der drei Unternehmen.";
                await sendWithDelay(msg, step);
            } else {
                // Let user make decision with the help of a heroCard with buttons
                const reply = { type: ActivityTypes.Message };

                // Create dynamic buttons with the same order that was randomly generated before
                const buttons = [
                    { type: ActionTypes.ImBack, title: investmentData.companies[user.order[0]], value: investmentData.companies[user.order[0]] },
                    { type: ActionTypes.ImBack, title: investmentData.companies[user.order[1]], value: investmentData.companies[user.order[1]] },
                    { type: ActionTypes.ImBack, title: investmentData.companies[user.order[2]], value: investmentData.companies[user.order[2]] }
                ];

                // Add buttons and text to hero card
                const card = CardFactory.heroCard('', undefined, buttons, { text: '' });
                var msg = "In **welches Unternehmen** möchtest du dein vorhandenes Investitionsbudget von **3000 Geldeinheiten** investieren? Du wirst in einem Jahr an dem **Gewinn** oder **Verlust** des Unternehmens beteiligt werden.";
                await sendWithDelay(msg, step);
                // Add card to reply and send
                reply.attachments = [card];
                await step.context.sendActivity(reply);
            }
        }
        async saveInvestmentDecision (step) {
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            // Get conversationData Object
            const conversationData = await this.conversationDataAccessor.get(step.context, {});
                
            // Check if choice is valid
            if (step.result.match(/acg/ig)) {
                // Save choice ACG
                user.choice = investmentData.companies[0];
            } else if (step.result.match(/breen/ig)) {
                // Save choice Breen
                user.choice = investmentData.companies[1];
            } else if (step.result.match(/plus/ig)) {
                // Save choice Plus
                user.choice = investmentData.companies[2];
            } else {
                // Invalid choice, set flag
                conversationData.invalidChoice = true;
                // Write conversationdata to State
                await this.conversationDataAccessor.set(step.context, conversationData);
                // Repeat dialog (directly reprompt)
                return await step.replaceDialog('investmentDecision');
            }
            
            
            
            // Determine, if user followed advisor or not and reply accordingly
            if (user.choice.localeCompare(investmentData.companies[user.order[1]]) == 0) {
                await step.context.sendActivity();
                user.follow = true;
                
                // Write userData to DB
                await this.userDataAccessor.set(step.context, user);

                // Inform user and prompt for waiting a fictive year
                if (treatment.civility == true) {
                    var msg = `Du hast dich dafür entschieden, in die **${user.choice}** zu investieren! Vielen Dank, dass du unseren Service genutzt hast und danke für dein Vertrauen.`;
                } else {
                    var msg = `Du hast dich dafür entschieden, in die **${user.choice}** zu investieren!`;
                }

                await sendWithDelay(msg, step);

                var msg = "Nun heißt es warten, bis die Aktienkurse sich verändern. Ob du Gewinn oder Verlust gemacht hast, wirst du später erfahren."


                await delay(msg, step).then(async function() { 
                    return await step.prompt(FINISH_PROMPT, msg , ['Beratung abschließen']);
                });
                
            } else {
                user.follow = false;

                // Write userData to DB
                await this.userDataAccessor.set(step.context, user);

                // Inform user and prompt for waiting a fictive year
                if (treatment.civility == true) {
                    var msg = `Du hast dich dafür entschieden, in die **${user.choice}** zu investieren! Vielen Dank, dass du unseren Service genutzt hast.`;
                } else {
                    var msg = `Du hast dich dafür entschieden, in die **${user.choice}** zu investieren!`;
                }
                await sendWithDelay(msg, step);

                var msg = "Nun heißt es warten, bis die Aktienkurse sich verändern. Ob du Gewinn oder Verlust gemacht hast, wirst du später erfahren."

                await delay(msg, step).then(async function() { 
                    return await step.prompt(FINISH_PROMPT, msg , ['Beratung abschließen']);
                });
               
            }
        }

        async finishAdvisory (step) {
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});
            
            // Route to endDialog
            return await step.replaceDialog('endDialog', userID);
        }


        async prepareStockPrep (step) {
            // Get userID from prior step and clear changes
            //const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});
            user.userID = step.options;

            // Get conversationData Object
            const conversationData = await this.conversationDataAccessor.get(step.context, {});


            // Read saved user from Database
            try {
                //const userImport = await this.memoryStorage.read([user.userID]);
                conversationData.userImport = await this.memoryStorage.read([user.userID]);
                //console.log("Importierter User in Result Dialog");
                //console.log(util.inspect(userImport, false, null, false ));
                //throw "Fehler";
            }
            catch(e) {
                console.log("Fehler beim Lesen des Datensatzes im Result Bot.")
                console.error(e);
                await console.log(Date(Date.now()));
                // retry after 3 seconds
                await timeout(3000);
                userImport = await this.memoryStorage.read([user.userID]);
                await console.log(Date(Date.now()));
            }

            console.log("Hier sollte userImport kommen");
            console.log(conversationData.userImport);

            try {
                var importSuccessful = conversationData.userImport[user.userID].name;
            }
            catch(e) {
                console.log(e);
                await step.context.sendActivity("Leider sind keine Nutzerdaten bekannt.");
                return await step.endDialog();
            }
 
            // Copy data from imported Dataset to user state variable
            user.name = conversationData.userImport[user.userID].name;
            user.age = conversationData.userImport[user.userID].age;
            user.gender = conversationData.userImport[user.userID].gender;
            user.education = conversationData.userImport[user.userID].education;
            user.complete = conversationData.userImport[user.userID].complete;
            user.advisoryConversationId = conversationData.userImport[user.userID].advisoryConversationId;
            user.userID = conversationData.userImport[user.userID].userID;
            user.roundCounter = conversationData.userImport[user.userID].roundCounter;
            user.riskchoices = conversationData.userImport[user.userID].riskchoices;
            user.riskAssessmentComplete = conversationData.userImport[user.userID].riskAssessmentComplete;
            user.riskDescription = conversationData.userImport[user.userID].riskDescription;
            user.order = conversationData.userImport[user.userID].order;
            user.botRecommendation = conversationData.userImport[user.userID].botRecommendation;
            user.choice = conversationData.userImport[user.userID].choice;
            user.follow = conversationData.userImport[user.userID].follow;
            user.eTag = "*";


            
            console.log("User from UserState with Data from ImportedUser:");
            console.log(util.inspect(user, false, null, false ));

            // Save ConversationID
            try {
                user.resultConversationId = step.context.activity.conversation.id;
            }
            catch(e) { 
                console.log("Saving ConversationID failed");
                console.log(e);
            }

            try {
                if(user.name) {
                    console.log("Nutzerdaten gefunden");
                }
            }
            catch (e) {
                await step.context.sendActivity("Leider sind keine Nutzerdaten bekannt.");
            }

            // Welcome user again
            if (treatment.rememberName == true) {
                var msg = `Hallo und willkommen zurück, ${user.name}. Ein Jahr ist vergangen.`;
            } else {
                var msg = "Ein Jahr ist nun vergangen."
            }
            
            await sendWithDelay(msg, step); 

            // Inform user
            if (treatment.selfReference == true) {
                var msg = "Sehen wir uns an, wie sich die Aktienkurse der Unternehmen entwickelt haben."; 
            } else {
                var msg = "Gleich siehst du, wie sich die Aktienkurse der Unternehmen entwickelt haben.";
            }
            await sendWithDelay(msg, step);


            // Write userData to Cache
            await this.userDataAccessor.set(step.context, user);


            return await step.next();

            var msg = "Bereit?"

                await delay(msg, step).then(async function() { 
                    return await step.prompt('textPrompt', msg);
                });
        }
            
        async presentStock (step) {
            // Get userID from prior step and clear changes
            //const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});
            const conversationData = await this.conversationDataAccessor.get(step.context, {});

            // Randomly assign stock price charts to companies
            conversationData.arr = ["0", "1", "2", "3"];
            conversationData.allOutcomes = ["win1", "win2", "loss1", "loss2"];
            conversationData.outcomes = [];
            conversationData.arrHelp = [];
            // Fill arrHelp with three random entries from arr ([0,1,2,3])
            for (var i = 1; i <= 3; i++) {
                conversationData.arrHelp.push(conversationData.arr.splice(Math.floor(Math.random() * conversationData.arr.length), 1)[0]);
            }
            // Map random arrHelp to allOutcomes and save them in outcomes array (18 possibilities)
            for (var i = 0; i < 3; i++) {
                conversationData.outcomes.push(conversationData.allOutcomes[conversationData.arrHelp[i]]);
            };

            // Predefine user.win sets to make dataset equally long --> less data-cleansing in Excel
            user.win1 = "none";
            user.win2 = "none";
            user.loss1 = "none";
            user.loss2 = "none";

            // Transform outcomes to verbal statements and save result in investmentData
            conversationData.statements = [];
            for (var i = 0; i < 3; i++) {
                if (conversationData.outcomes[i].localeCompare("win1") == 0) {
                    conversationData.statements[i] = `Der Wert der **${investmentData.companies[user.order[i]]}** hat sich um 33% **erhöht**.`
                    user.win1 = investmentData.companies[user.order[i]];
                } else if (conversationData.outcomes[i].localeCompare("win2") == 0) {
                    conversationData.statements[i] = `Der Wert der **${investmentData.companies[user.order[i]]}** hat sich um 17% **erhöht**.`
                    user.win2 = investmentData.companies[user.order[i]];
                } else if (conversationData.outcomes[i].localeCompare("loss1") == 0) {
                    conversationData.statements[i] = `Der Wert der **${investmentData.companies[user.order[i]]}** hat sich um 17% **verringert**.`
                    user.loss1 = investmentData.companies[user.order[i]];
                } else if (conversationData.outcomes[i].localeCompare("loss2") == 0) {
                    conversationData.statements[i] = `Der Wert der **${investmentData.companies[user.order[i]]}** hat sich um 33% **verringert**.`
                    user.loss2 = investmentData.companies[user.order[i]];
                }
            }

                    

            // Present stock price charts in a carousel
            conversationData.resultChart1 = "" + investmentData.companies[user.order[0]].toLowerCase().replace(/\s/g, '') + "_" + conversationData.outcomes[0];
            conversationData.resultChart2 = "" + investmentData.companies[user.order[1]].toLowerCase().replace(/\s/g, '') + "_" + conversationData.outcomes[1];
            conversationData.resultChart3 = "" + investmentData.companies[user.order[2]].toLowerCase().replace(/\s/g, '') + "_" + conversationData.outcomes[2];

            conversationData.messageWithCarouselOfCharts = MessageFactory.carousel([
                this.getStockPriceAttachment(conversationData.resultChart1),
                this.getStockPriceAttachment(conversationData.resultChart2),
                this.getStockPriceAttachment(conversationData.resultChart3),
            ],"");
            var msg = "So haben sich die Aktienkurse der Unternehmen **relativ zu ihrem Wert von vor einem Jahr** entwickelt:";
            await sendWithDelay(msg, step);  
            await step.context.sendActivity(conversationData.messageWithCarouselOfCharts);

            // Create Statement
            conversationData.statement = "";
            for (var i = 0; i < 3; i++) {
                conversationData.statement = "" + conversationData.statement + "\n" + conversationData.statements[i];
            }

            await sendWithDelay(conversationData.statement, step);  

            // Write userData to DB
            await this.userDataAccessor.set(step.context, user);

            return await step.next();

            // Interrupt flow until user klicks continue
            await delay(statement, step).then(async function() { 
                return await step.prompt('textPrompt', statement);
            });
            
            
        }


        async presentPayout (step) {
            // Get userID from prior step and clear changes
            //const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});
            console.log("User in drittem Teil von Result Dialog");
            console.log(user);
                       
            
            // Determine user's payout, send information to user and save in investmentData
            if (user.choice.localeCompare(user.win1) == 0) {
                var msg = `Du hast in die **${user.choice}** investiert. Deine Investitionssumme von 3000 Geldeinheiten hat sich somit auf **4000 Geldeinheiten erhöht** und du hast **1000 Geldeinheiten Gewinn gemacht**.`;
                await sendWithDelay(msg, step);  
                user.payout = "Du bekommst 7000 Geldeinheiten = 7.00€ ausgezahlt.";
                user.payoutNumber = "7.00";
            } else if (user.choice.localeCompare(user.win2) == 0) {
                var msg = `Du hast in die **${user.choice}** investiert. Deine Investitionssumme von 3000 Geldeinheiten hat sich somit auf **3500 Geldeinheiten erhöht** und du hast **500 Geldeinheiten Gewinn gemacht**.`;
                await sendWithDelay(msg, step);
                user.payout = "Du bekommst 6500 Geldeinheiten = 6.50€ ausgezahlt.";
                user.payoutNumber = "6.50";
            } else if (user.choice.localeCompare(user.loss1) == 0) {
                var msg = `Du hast in die **${user.choice}** investiert. Deine Investitionssumme von 3000 Geldeinheiten hat sich somit auf **2500 Geldeinheiten verringert** und du hast **500 Geldeinheiten Verlust gemacht**.`;
                await sendWithDelay(msg, step);
                user.payout = "Du bekommst 5500 Geldeinheiten = 5.50€ ausgezahlt.";
                user.payoutNumber = "5.50";
            } else if (user.choice.localeCompare(user.loss2) == 0) {
                var msg = `Du hast in die **${user.choice}** investiert. Deine Investitionssumme von 3000 Geldeinheiten hat sich somit auf **2000 Geldeinheiten verringert** und du hast **1000 Geldeinheiten Verlust gemacht**.`;
                await sendWithDelay(msg, step);
                user.payout = "Du bekommst 5000 Geldeinheiten = 5.00€ ausgezahlt.";
                user.payoutNumber = "5.00";
            }

            // Praise / Apologize 
            if (treatment.apologizePraise) {
                if (user.choice.localeCompare(user.win1) == 0 || user.choice.localeCompare(user.win2) == 0) {
                    var female = "weiblich";
                    if (female.localeCompare(user.gender) == 0) {
                        var msg = `Herzlichen Glückwunsch, **${user.name}**, zu deinem Gewinn! **Du hast dein Können als Investorin bewiesen**.`
                    }
                        var msg = `Herzlichen Glückwunsch, **${user.name}**, zu deinem Gewinn! **Du hast dein Können als Investor bewiesen**.`
                } else {
                    var msg = `**${user.name}**, **es tut mir wirklich Leid**, dass die Aktienkurse deiner Aktie gefallen sind. Dein nächstes Investment wird sich bestimmt besser entwickeln.`
                }
                await sendWithDelay(msg, step);
            }

            // Write userData to DB
            await this.userDataAccessor.set(step.context, user);

            // Loop main menu or go to next dialog (depending on test mode)
            if (testing == true) {
                // Return to main dialog                
                return await step.beginDialog('mainMenu', user.userID);
            } else {
                return await step.replaceDialog('endDialog', user.userID);
            }
        }



        // Method for attaching an inline attachment to a message. For online or blob storage attachments, look into the 15.handling-attachments sample
        getStockPriceAttachment (companyResult) {
            const imageData = fs.readFileSync(path.join(__dirname, `/resources/images/stockcharts/${companyResult}.png`));
            const base64Image = Buffer.from(imageData).toString('base64');

            return {
                name: 'pp.png',
                contentType: 'image/png',
                contentUrl: `data:image/png;base64,${ base64Image }`
            }
        }

        async end (step) {
            console.log("End Dialog");

            // Read ConversationData from DB
            const conversationData = await this.conversationDataAccessor.get(step.context, {});

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            // Save data to DB, inform user and set repeat flag
            if (!conversationData.endRepeat) {                       
                // Write userData to DB 
                await this.userDataAccessor.set(step.context, user);

                console.log("User im Enddialog vor speichern in DB");
                console.log(user);

                conversationData.changes = {};
                conversationData.changes[user.userID] = user;

                try {
                    
                    await this.memoryStorage.write(conversationData.changes);
                    //throw "Fehler";
                }
                catch(e) {
                    console.error(e);
                    await console.log(Date(Date.now()));
                    // retry after 2 seconds
                    await timeout(3000);
                    await this.memoryStorage.write(conversationData.changes);
                    await console.log(Date(Date.now()));
                }       

                console.log("User nach speichern in DB");
                console.log(user);

                // Set repeat flag for enddialog
                conversationData.endRepeat = true;
                console.log(`${user.name} im Enddialog angekommen. EndRepeatflag: ${conversationData.endRepeat}.`)

                // Inform user
                if (treatment.rememberName == true) {
                    var msg = `Danke, ${user.name}, für deine Zeit. Der Beratungsprozess ist nun abgeschlossen.`;
                } 

                await sendWithDelay(msg, step);   
            }


            // Write userData to State
            await this.userDataAccessor.set(step.context, user);

            
            // Farewell and pause dialog
            if (treatment.introduction == true && conversationData.mode.localeCompare("A") == 0) {
                await delay("Bis bald!", step).then(async function() { 
                    return await step.prompt(CONFIRM_PROMPT2, "Bis bald! Wir schreiben wieder, wenn die Aktienkurse sich verändert haben.");
                });
            } else if (treatment.introduction == true && conversationData.mode.localeCompare("R") == 0) {
                await delay("Bis bald!", step).then(async function() { 
                    return await step.prompt(CONFIRM_PROMPT2, "Bis bald!");
                });
            } else {
                return await step.prompt(CONFIRM_PROMPT2, "Der Beratungsprozess ist nun abgeschlossen.");
            }



        }

        async loopEnd (step) {
            // Get userID from prior step and clear changes
            //const userID = step.options;

            // Read UserData from DB (im Result Bot wird hier neuer UserState Datensatz erzeugt und auf den alten kann nicht mehr zugegriffen werden (?))
            const user = await this.userDataAccessor.get(step.context, {test: 'test'});
            

            console.log("UserData in LoopEnd Dialog");
            console.log(user);

          
            if (treatment.rememberName == true) {
                await delay(`Name, der Beratungsprozess ist nun wirklich abgeschlossen!`, step).then(async function() { 
                    return await step.prompt(CONFIRM_PROMPT2, `Der Beratungsprozess ist nun wirklich abgeschlossen! Ich muss jetzt los und den Markt analysieren.`);
                });
            } else {
                return await step.prompt(CONFIRM_PROMPT2, `Der Beratungsprozess ist nun wirklich abgeschlossen! Das Robo-Advisory System wird pausiert.`);
            }
        }

        // Dialogs for payout display

        async displayPayout (step) {
            console.log("Display Payout");
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});


            var msg = `Hallo ${user.name}. Am Ausgang kannst du dir deine Bezahlung von ${user.payout} abholen.`;
            await sendWithDelay(msg, step);
        }

        async startBot (step) {
            console.log("Bot waiting for user to start");    
            return await step.prompt(CONFIRM_PROMPT, "");
        }

        async startDialog (step) {
            // Get userID from prior step and clear changes
            const userID = step.options;

            // Read UserData from DB
            const user = await this.userDataAccessor.get(step.context, {});

            try{ var firstUserMessage = step.result }
            catch(e) { console.log(e) }

            console.log("First user message: " + firstUserMessage);
            if (firstUserMessage.toLowerCase() == "start") {
                console.log("Bot Started by user");
                try { 
                    if (user.name) {
                        if (treatment.rememberName == true) {
                            await step.context.sendActivity(`Hinweis: Nutzer ${user.name} erkannt.`);
                        } else {
                            await step.context.sendActivity(`Hinweis: Nutzer erkannt.`);
                        }   
                    }
                }
                catch(e) { console.log("Nutzer ist neu") }

                // Route to correct dialog
                if (advisoryDialog == true && payoutDialog == false) {
                    await step.replaceDialog("welcome", userID);
                }
                if (advisoryDialog == false && payoutDialog == true) {
                    await step.replaceDialog('investmentResult', userID)
                }
                
            } else {
                return await step.replaceDialog("startBot", userID);
            }

        }

    /**
     *
     * Use onTurn to handle an incoming activity, received from a user, process it, and reply as needed
     *
     * @param {TurnContext} on turn context object.
     */
    async onTurn(turnContext) {
        
        const dc = await this.dialogSet.createContext(turnContext);

        //await logMessageText(this.memoryStorage, turnContext, this.userState);

        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        if (turnContext.activity.type === ActivityTypes.value){
            console.log(turnContext.activity.type.value);
        }

        if (turnContext.activity.type === ActivityTypes.Message) {          
            // Continue ongoing dialog
            await dc.continueDialog();
        } else if (turnContext.activity.type === ActivityTypes.ConversationUpdate) {
            // Do we have any new members added to the conversation?
            if (turnContext.activity.membersAdded.length !== 0) {
                // Iterate over all new members added to the conversation
                for (var idx in turnContext.activity.membersAdded) {
                    // Greet anyone that was not the target (recipient) of this message.
                    // Since the bot is the recipient for events from the channel,
                    // context.activity.membersAdded === context.activity.recipient.Id indicates the
                    // bot was added to the conversation, and the opposite indicates this is a user.
                    if (turnContext.activity.membersAdded[idx].id !== turnContext.activity.recipient.id) {
                        
                        
                        // Funktionierender Code, wenn WebChat gefixt
                        console.log("User added");
                        
                        // Read ConversationData from State
                        const conversationData = await this.conversationDataAccessor.get(turnContext, {});
                        const user = await this.userDataAccessor.get(turnContext, {});

                        
                        // Get userID which is either IDA for advisory or IDR for result
                        conversationData.URLparam = turnContext.activity.membersAdded[idx].id;

                        // Manually set userId for Emulator use
                        conversationData.URLparam = "1234R";
                        

                        // Set userID
                        if (!conversationData.userID) {
                            console.log("UserID wird eingetragen");
                            conversationData.userID = conversationData.URLparam.substring(0, conversationData.URLparam.length-1);
                            console.log("Eingetragene user ID:" + conversationData.userID);
                        }
        
                        // Get last character which determines mode
                        conversationData.mode = conversationData.URLparam.substring(conversationData.URLparam.length-1, conversationData.URLparam.length);
                        
                        // Write user and conversationdata to State
                        await this.conversationDataAccessor.set(turnContext, conversationData);
                        await this.userDataAccessor.set(turnContext, user);
                        
                        
                        // Route to correct dialog depending on treatment and bot type
                        if (treatment.initiation == true && conversationData.mode.localeCompare("A") == 0) {
                            console.log("Advisory Modus");
                            await dc.beginDialog('welcome', conversationData.userID);
                        } else if (treatment.initiation == false) {
                            await dc.beginDialog('startBot', conversationData.userID);
                        } else if (treatment.initiation == true && conversationData.mode.localeCompare("R") == 0) {
                            console.log("Result Modus");
                            await dc.beginDialog('investmentResult', conversationData.userID)
                        }
                    }
                    if (turnContext.activity.membersAdded[idx].id === turnContext.activity.recipient.id) {
                        // Start the dialog.
                        console.log("Bot joined");
                        
                    }
                }
            }
        }
    
        // Save changes to the user state.
        await this.userState.saveChanges(turnContext);

        // End this turn by saving changes to the conversation state.
        await this.conversationState.saveChanges(turnContext);
    }
}
exports.MyBot = MyBot;



// Function that calls sendActivity after Delay
async function sendWithDelay(msg, step) {
    await delay(msg, step).then(async function() { 
        await step.context.sendActivity(msg);
    });
}

// Function returning promise after timeout calculated by calculateDelay()-Function
function delay(message, step, v) {
    //console.log("Delay Funktion");
    
    // Default value for timeout is 0
    var t = 0;
    // Default value for user's message bot has to "read"
    var userMessage = "";

    // Determine which treatment is active and set param for calculateDelay(), default at "zero"
    var delayMode = "zero";
    if (treatment.responseTimeVar == true) { delayMode = "var" }
    if (treatment.responseTimeFix == true) { delayMode = "fix" }

    // Check if user sent message bot has to "read" and save user message 
    try {
        // For normal messages step.result
        if (step.result) { userMessage = step.result }
    } catch(err) { /*console.log("Delay(): User hasn't sent answer that needs to be read.")*/ }

    try {
        // For Choice Prompts step.result.value
        if (step.result.value) { userMessage = step.result.value }
    } catch(err) { 
        //console.log("Delay(): User hasn't sent choice prompt answer that needs to be read.") 
    }   
    
       
    
    //console.log("Die UserMessage die gelesen werden muss lautet: " + userMessage);
    //console.log(userMessage);

    // Get Delay-Time from calculateDelay()
    t = calculateDelay(userMessage, message, delayMode);

    return new Promise(function(resolve) { 
        setTimeout(resolve.bind(null, v), t)
    });
}

function calculateDelay(previousMessage, botResponse, mode) {
    //console.log("Calculate Delay Funktion");
    // STATIC: Return static delay length
    if (mode === "zero"){
        return 0; // + networkdelay
    } else if (mode === "fix"){
        return 2300;
    } else {
        // DYNAMIC:
        // previousMessage can be either from user or bot (if it's a consecutive message)
        var previousMessageComplexity;
        var botResponseComplexity;
        var readingTime;
        var typingTime;
        var responseTime;

        // "Reading" (either bot needs to read a user's message or allow user to read a previous message before sending next one)
        if (!previousMessage) {
            // Previous message was just a confirmation, no delay (reading) needed
            previousMessageComplexity = 0;
            readingTime = 0;
        } else {
            // Calculate complexity
            previousMessageComplexity = calculateMessageComplexity(previousMessage.toString());
            if (previousMessageComplexity <= 0) {
                // Message not complex enough, no delay needed
                previousMessageComplexity = 0;
                readingTime = 0;
            } else {
                // More complex message, calculate delay
                console.log("%s %s", previousMessage, previousMessageComplexity);
                readingTime = (0.75 * (Math.log(previousMessageComplexity + 0.5) + 1.5)) * 1000; // 0.5ln(x+0.5)+1.5
            }
        }


        // Typing
        botResponseComplexity = calculateMessageComplexity(botResponse.toString());
        if (botResponseComplexity <= 0) {
            // Response not complex enough, no delay needed
            botResponseComplexity = 0;
            typingTime = 0;
        } else {
            // More complex response, calculate delay
            typingTime = (0.75 * (Math.log(botResponseComplexity + 0.5) + 1.5)) * 1000;  // 0.5ln(x+0.5)+1.5
        }


        // Sum up both times to calculate delay, subtract existing network delay
        responseTime = (readingTime + typingTime);
        //console.log("INFO: Delay calculated: %s, %s | %s, %s -> %s", previousMessageComplexity, readingTime, botResponseComplexity, typingTime, responseTime);


        // Delay should not be less than 0
        return responseTime > 0 ? responseTime : 0;
    }
}

function calculateMessageComplexity (message) {
    return fleschKincaid({
        sentence: countSentences(message),
        word: countWords(message),
        syllable: (syllable(message) > 0) ? syllable(message) : 1 // return 1 if no syllable, e.g. for numbers?
    });
}

function countWords(sentence) {
    var count = 0,
        words = sentence
            .replace(/[.,?!;()"'-]/g, " ")
            .replace(/\s+/g, " ")
            .toLowerCase()
            .split(" ");

    words.forEach(function (word) {
        if (word != ""){
            count++;
        }
    });

    return count;
}

function countSentences(sentences){
    var regex, split, count;
    regex = /\. |\? |! /g;

    if (regex.test(sentences) === true) {
        split = sentences.split(regex);
        count = split.length;
    } else {
        count = 1;
    }
    return count;
}


// Test if user input matches any valid option
function validateInput(input, obj) {
    var match = [];
    match[1] = 0;

    var eintraege = Object.keys(obj);
    // Get Object size
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }

    // Compare user input to possible response options
    for (var j = 0; j < size; j++) {
        // Get the correct way of spelling the word
        var solution = obj[eintraege[j]]['solution'];

        // Get the array with possible spelling options
        var possibilities = obj[eintraege[j]]['possibilities'];
        var len = possibilities.length;

        // Go through list with all spelling options and compare user input with options
        for (var i = 0; i < len; i++) {
            var test = stringSimilarity(input, possibilities[i]);
            //console.log("Test" + i + ": " + test);
            if (test >= 0.8 && test > match[1]) {
                match[0] = solution;
                match[1] = test;
            }
        }
    }

    // Check if there was a match 
    if (match[0]) {
        //console.log('A match with ' + match[1]*100 + '% accuracy was found: ' + match[0])
    } else {
        //console.log('The user input "' + input + '" could not be matched.')
    }
    
    return match[0];
}

// Check if Object is empty
function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

// Function that enables usage of setTimeout in async functions by returning a promise
function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}