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
const WELCOMED_USER = 'welcomedUserProperty';
const CONVERSATION_DATA_PROPERTY = 'conversationData';
const USER_DATA_PROPERTY = 'userData';
const RISK_DATA_PROPERTY = 'userRiskData';
const INVESTMENT_DATA_PROPERTY = 'userInvestmentData';

// Accessor for the workaround
const WORK_AROUND = 'workAroundProperty';


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
        prompt: "Wie alt bist du? **(Bitte Alter als Zahl eingeben)**",
        recognize: (step) => {
            var input = step.result.toString();
            var result = Recognizers.recognizeNumber(input, Recognizers.Culture.German);
            result = parseInt(result[0].resolution.value);
            return result;
        },
        validate: async (step) => {
            try {
                // Recognize the input as a number. This works for responses such as
                // "twelve" as well as "12".
                var input = step.result.toString();
                var result = Recognizers.recognizeNumber(input, Recognizers.Culture.German);
                var age = parseInt(result[0].resolution.value);
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
/*     major: {
        tag: "Studiengang",
        prompt: "Was studierst du?",
        prompt_other: "Dein Studiengang war wohl **nicht in der Liste**. Wie heißt dein Studiengang?",
    }, */
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
        possibilities: ['bachelor', 'Bachelor', 'B.Sc.', 'B. Sc.', 'b sc', 'b.sc.', 'bsc', 'b.sc'],
    },
    master: {
        solution: "Master",
        possibilities: ['master', 'Master', 'M.Sc.', 'M. Sc.', 'm sc', 'm.sc.', 'msc', 'm.sc'],
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
        possibilities: ['männlich', 'männl', 'mann', 'junge'],
    },
    female: {
        solution: "weiblich",
        possibilities: ['weiblich', 'weibl', 'frau', 'mädchen'],
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
        possibilities: ['ja', 'yes', 'jop', 'jupp', 'jup', 'klar', 'si', 'oui', 'klaro', 'jaha', 'jaa', 'ya', 'yup', 'yas'],
    },
    no: {
        solution: "Nein",
        possibilities: ['nein', 'nö', 'nop', 'nope', 'no', 'auf keinen fall', 'ne', 'nee', 'niemals'],
    },
}

// Additional properties relevant for user data 
const userDataProperties = {
    display: {value: ""},
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
    introduction: true,
    selfReference: true,
    civility: true,
    rememberName: true,
    initiation: true,
    smallTalk: false,
    apologizePraise: false,
    gender: false,
}

// Activates or deactivates the advisory dialog and payout dialog (split in experiment)
const advisoryDialog = true;
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

        // Conversation Data Property for ConversationState
        this.conversationData = conversationState.createProperty(CONVERSATION_DATA_PROPERTY);
        this.workAround = conversationState.createProperty(WORK_AROUND);

        // Properties for UserState   
        this.welcomedUserProperty = userState.createProperty(WELCOMED_USER);  
        //this.userData = userState.createProperty(USER_DATA_PROPERTY);
        //this.riskData = userState.createProperty(RISK_DATA_PROPERTY);
        //this.investmentData = userState.createProperty(INVESTMENT_DATA_PROPERTY);


        // Add prompts that will be used in dialogs
        this.dialogSet = dialogSet;
        this.dialogSet.add(new TextPrompt('textPrompt'));
        this.dialogSet.add(new ChoicePrompt('choicePrompt'));
        this.dialogSet.add(new NumberPrompt('numberPrompt'));


        // Welcome dialog
        this.dialogSet.add(new WaterfallDialog('welcome', [
            this.welcomeUser.bind(this),                
        ]));

        // Main Menu Dialog
        this.dialogSet.add(new WaterfallDialog('mainMenu', [
            async function (step) {
                // Get userID from prior step
                var userID = step.options;
               // Return await step.prompt('choicePrompt', "Wähle eine der folgenden Optionen aus", ['Order Dinner', 'Reserve a table', 'Profil erstellen']);
               return await step.prompt('choicePrompt', "**Bitte wähle** eine der folgenden Optionen aus", ['Profil erstellen', 'Profil anzeigen', 'Profil löschen', 'Risikoverhalten', 'Investment']);
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
            this.loopEnd.bind(this),
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
        
        /* this.userID = step.options;
        this.changes = {};
        this.userData = {
            eTag: '*',
        } */

        var userID = step.options;
        var user = {};
        var changes = {};
        var emptyUserData = {

            name: "",
            age: "",
            gender: "",
            education: "",
            major: "",

            riskData: {
                roundCounter: "",
                riskAssessmentComplete: "",
                riskDescription: "",
                repeat: "",
                choices: "",
            },

            investData: {
                repeat: "",
                order: "",
                choice: "",
                follow: "",
                win1: "",
                win2: "",
                loss1: "",
                loss2: "",
            },
            
            endRepeat: "",
            eTag: '*',
        }
        

        //await step.context.sendActivity("userID: " + userID);



        // Read userData object
        try {
            user = await this.memoryStorage.read([userID]);
            //await step.context.sendActivity("User Object read from DB: "+ user);
            //await step.context.sendActivity("User Object read from DB: \n" + util.inspect(user, false, null, false /* enable colors */));
        }
        catch(e) {
            await step.context.sendActivity("Reading user data failed");
            await step.context.sendActivity(e);
        }

        // If user is new, create UserData object and save it to DB and read it for further use
        if(isEmpty(user)) {
            //await step.context.sendActivity("New User Detected");
            changes[userID] = emptyUserData;
            await this.memoryStorage.write(changes);
            user = await this.memoryStorage.read([userID]);
            //await step.context.sendActivity("New user data:\n" + util.inspect(user, false, null, false /* enable colors */));
        }

        
        


              
            
                  
        // Welcome the user
        if (treatment.introduction == true && treatment.rememberName == true && treatment.gender == true) {
            await sendWithDelay("Hallo und herzlich willkommen, ich bin **Charles**, dein persönlicher **Investmentberater**. Ich begleite dich durch den Beratungsprozess.", step);
        } else if (treatment.introduction == true && treatment.gender == false) {
            var msg = "Hallo und herzlich willkommen, ich bin ein **Robo-Advisor**. Ich begleite dich durch den Beratungsprozess.";
            await sendWithDelay(msg, step);
        } else if (treatment.introduction == false && treatment.selfReference == false && treatment.rememberName == false) {
            var msg = "Du wirst nun durch den Beratungsprozess begleitet.";
            await sendWithDelay(msg, step);
        }
            
        if (testing == true) {
            // Start main dialog                
            return await step.beginDialog('mainMenu', userID);
        } else {
            return await step.beginDialog('createProfile', userID);
        }
    }

    // Functions for creating UserProfile 
        async promptForName (step) {
            console.log("Name Prompt");

            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};
            
            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);
            
            // Before prompting, check if value already exists
            if(!user[userID].name){
                if (user[userID].deleted == true) {
                        
                        if (treatment.selfReference == true) {
                            var msg = "Ich stelle dir nun die gleichen Fragen erneut.";
                            await sendWithDelay(msg, step);
                        } else {
                            var msg = "Im folgenden nochmal die gleichen Fragen.";
                            await sendWithDelay(msg, step);
                        }
                } else {
                        if (treatment.selfReference == true) {
                            var msg = "Ich stelle dir nun ein paar Fragen, um deine wichtigsten Daten zu erfassen.";
                            await sendWithDelay(msg, step);
                        } else {
                            var msg = "Im folgenden ein paar Fragen, um deine wichtigsten Daten zu erfassen.";
                            await sendWithDelay(msg, step);
                        }
                        
                }
                // Username doesn't exist --> Prompt
                await delay(userData.name.prompt, step).then(async function() { 
                    return await step.prompt('textPrompt', userData.name.prompt);
                });
            } else {
                return await step.next();
            }
        }

        async promptForAge (step) {
            console.log("Age Prompt");

            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);
            
            
            // Before saving entry, check if it already exists
            if(!user[userID].name) {
                user[userID].name = step.result;

                // Write userData to DB
                changes[userID] = user[userID];
                try {
                    await this.memoryStorage.write(changes);
                }
                catch (e) {}
                

                // Notify user about his name being remembered
                if (treatment.rememberName == true) {
                    var msg = `Hallo **${user[userID].name}**! Danke, dass du mir deinen Namen verraten hast. Ich werde ihn mir ab jetzt merken.`;
                    await sendWithDelay(msg, step);
                }
            }
            // Before prompting, check if value already exists
            if(!user[userID].age) {
                await delay(userData.age.prompt, step).then(async function() { 
                    return await step.prompt('textPrompt', userData.age.prompt);
                });
                
            } else {
                return await step.next();
            }
        }
        async promptForGender (step) {
            console.log("Gender Prompt");

            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // Before saving entry, check if it already exists
            if(!user[userID].age){
                // Validate entered age
                let validated = await userData.age.validate(step)
                if (validated){
                    user[userID].age = userData.age.recognize(step);
                    
                // Write userData to DB
                changes[userID] = user[userID];
                try {
                    await this.memoryStorage.write(changes);
                }
                catch (e) {}

                } else if (!validated) {
                    // Prompt for age again
                    return await step.replaceDialog("createProfile", userID);
                }
            } 
            // Before prompting, check if value already exists
            if(!user[userID].gender){
                // Call Gender Prompt
                await delay(userData.gender.prompt, step).then(async function() { 
                    return await step.prompt('textPrompt', userData.gender.prompt);
                });
                
            } else {
                return await step.next();
            }
        }
        async promptForEducation (step) {
            console.log("Education Prompt");
           
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // Before saving entry, check if it already exists
            if(!user[userID].gender){
                var validation = await validateInput(step.result, genders);
                if (validation) {
                    user[userID].gender = validation;
                } else {
                    if(treatment.selfReference == true) { var msg = "Sorry, das habe ich nicht verstanden. Bitte versuche es erneut." }
                    else { var msg = "Die Eingabe wurde nicht erkannt. Versuche es erneut."}
                    await sendWithDelay(msg, step);
                    return await step.replaceDialog('createProfile', userID);
                }
                
                // Write userData to DB
                changes[userID] = user[userID];
                try {
                    await this.memoryStorage.write(changes);
                }
                catch (e) {}
            }
            // Before prompting, check if value already exists
            if (!user[userID].education) {

                // Prompt for highest education with list of education options
                await delay(userData.education.prompt, step).then(async function() { 
                    return await step.prompt('textPrompt', userData.education.prompt);
                });
            } else {
                return await step.next();
            }
        }
        async promptForMajor (step) {
            console.log("Major Prompt");

            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // Before saving entry, check if it already exists
            if(!user[userID].education){
                var validation = await validateInput(step.result, educations);
                if (validation) {
                    user[userID].education = validation;
                } else {
                    if(treatment.selfReference == true) { var msg = "Sorry, das habe ich nicht verstanden. Bitte versuche es erneut." }
                    else { var msg = "Die Eingabe wurde nicht erkannt. Versuche es erneut."}
                    await sendWithDelay(msg, step);

                    return await step.replaceDialog('createProfile', userID);
                }
                
                // Write userData to DB
                changes[userID] = user[userID];
                try {
                    await this.memoryStorage.write(changes);
                }
                catch (e) {}
            }
            // Before prompting, check if value already exists
            if (!user[userID].major){
                await delay(userData.major.prompt, step).then(async function() { 
                    return await step.prompt('textPrompt', userData.major.prompt);
                });
            } else {
                return await step.next();
            }
        }
        
        async completeProfile (step) {
            console.log("Complete");
            
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // Before saving entry, check if it already exists
            if(!user[userID].education){
                var validation = await validateInput(step.result, educations);
                if (validation) {
                    user[userID].education = validation;
                } else {
                    if(treatment.selfReference == true) { var msg = "Sorry, das habe ich nicht verstanden. Bitte versuche es erneut." }
                    else { var msg = "Die Eingabe wurde nicht erkannt. Versuche es erneut."}
                    await sendWithDelay(msg, step);

                    return await step.replaceDialog('createProfile', userID);
                }
                
                // Write userData to DB
                changes[userID] = user[userID];
                try {
                    await this.memoryStorage.write(changes);
                }
                catch (e) {}
            }

            /* // Before saving entry, check if it already exists
            if (!user[userID].major){
                var validation = await validateInput(step.result, majors);
                if (validation) {
                    user[userID].major = validation;

                // Write userData to DB
                changes[userID] = user[userID];
                try {
                    await this.memoryStorage.write(changes);
                }
                catch (e) {}

                } else {
                    if (treatment.selfReference == true) { var msg = "Sorry, das habe ich nicht verstanden. Bitte probiere einen der folgenden Studiengänge:" }
                    else { var msg = "Die Eingabe wurde nicht erkannt. Probiere einen Studiengang folgender Liste: "}
                    await sendWithDelay(msg, step);

                    // Present List of available options
                    var eintraege = Object.keys(majors);
                    var size = 0, key, list = "";
                    for (key in majors) {
                        if (majors.hasOwnProperty(key)) size++;
                    }
                    for (var j = 0; j < size; j++) {
                        // Get the correct way of spelling the word
                        list = "" + list  + majors[eintraege[j]]['solution'] + "\n";
                    }
                    await sendWithDelay(list, step);
                    
                    return await step.replaceDialog('createProfile', userID);
                }
            } */
            if (!user[userID].complete){
                console.log('test1');
                // Read UserData from DB
                var user = await this.memoryStorage.read([userID]);
                // Set user to complete
                user[userID].complete = true;

                // Write userData to DB
                changes[userID] = user[userID];
                try {
                    await this.memoryStorage.write(changes);
                }
                catch (e) {}

                if (treatment.rememberName == true) {
                    var msg = `Super **${user[userID].name}**, dein Profil ist nun vollständig. Danke für deine Mitarbeit.`;
                } else {
                    var msg = `Super, dein Profil ist nun vollständig.`;
                }
                await sendWithDelay(msg, step);
            } else {
                console.log('test3');
                var msg = `**${user[userID].name}**, du hast dein Profil bereits ausgefüllt.`;
                await sendWithDelay(msg, step);
            }
            if (testing == true) {
                // Return to main dialog                
                return await step.beginDialog('mainMenu', userID);
            } else {
                console.log('test4');
                return await step.beginDialog('displayProfile', userID);
            }
        }

        // Function for displaying user profile
        async displayProfile (step) {
            console.log("Display Profile");
            
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // If Profile not completed, end dialog and return to main menu
            if (!user[userID].complete){
                var msg = "Dein Profil ist noch nicht vollständig.";
                await sendWithDelay(msg, step);
                return await step.replaceDialog('createProfile', userID);
            }
            // Create array from individual user data
            var userArr = Object.values(user[userID]);
            console.log(userArr);
            var i = 0;
            // Iterate through user data and create string
            Object.keys(userData).forEach(function(key) {
                console.log(userArr[i]);
                userDataProperties.display.value = "" + userDataProperties.display.value  + "**" + userData[key].tag + "**" + ': ' + userArr[i].toString() + '\n';
                i++;
            })
            // Replace undefined with ""
            userDataProperties.display.value = userDataProperties.display.value.replace(/undefined/g, "");
            // Display profile to user
            var msg = "Das sind deine Profildaten:";
            await sendWithDelay(msg, step);
            var msg = userDataProperties.display.value;
            await sendWithDelay(msg, step);
            // Clear display string
            userDataProperties.display.value = "";

            // Prompt user, if profile is correct
            await delay("Sind deine Daten korrekt?", step).then(async function() { 
                return await step.prompt('textPrompt', "Sind deine Daten korrekt?");
            });
        }
        async isProfileCorrect (step) {

            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            try {
                var validation = await validateInput(step.result, yesno);
            }
            catch (e) {await step.context.sendActivity(e)}
            
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
                    // Delete Profile 
                    if (treatment.civility == true) {
                        var msg = "Bitte erstelle dein Profil erneut."
                    } else {
                        var msg = "Erstelle dein Profil erneut."
                    }
                    
                    await sendWithDelay(msg, step);
                    return await step.replaceDialog('deleteProfile', userID);
                }
            }
            catch (e) {await step.context.sendActivity(e)}
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
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // Save ID to use it in next method
            var idTemp = userID;

            // Iterate through user data and delete entries
            Object.keys(user[idTemp]).forEach(function(key) {
                user[idTemp][key] = "";
            })
            // Clear "complete" Tag
            user[userID].complete = false;
            user[userID].deleted = true;

            // Write userData to DB
            changes[userID] = user[userID];
            try {
                await this.memoryStorage.write(changes);
            }
            catch (e) {}

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
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);
            
            var roundCounterTemp = ""
            try {
                roundCounterTemp = user[userID].riskData.roundCounter;
            }
            catch (e) {
                roundCounterTemp = "";
            }

            // Überprüfen, ob Spiel bereits läuft, falls nicht, neue Runde starten 
            if (!roundCounterTemp) {

                try {
                    user[userID].riskData.roundCounter = 1;
                }
                catch (e) { await step.context.sendActivity(e) }
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
                eine festgelegte Auszahlung haben.";
                await sendWithDelay(msg, step);               
            }

            
            // If RiskAssessment already finished, notify user and go back to main menu
            if (user[userID].riskData.riskAssessmentComplete == true) {
                var msg = `Dein Risikoverhalten wurde bereits ermittelt. Du bist **${user[userID].riskData.riskDescription}**.`;
                await sendWithDelay(msg, step);
                if (testing == true) {
                    // Return to main dialog                
                    return await step.beginDialog('mainMenu', userID);
                } else {
                    return await step.beginDialog('investmentDecision', userID);
                }
                // Only present card, if round is not a repeated round
            } else if (user[userID].riskData.repeat == true){
                user[userID].riskData.repeat = false;
                await step.context.sendActivity("");
            } else {
                // Present Adaptive Card 1-10 for gathering User Input
                await step.context.sendActivity({
                    text: `Runde  ${user[userID].riskData.roundCounter}`,
                    attachments: [CardFactory.adaptiveCard(riskCard[user[userID].riskData.roundCounter])]
                });
            }
            // Write userData to DB
            changes[userID] = user[userID];
            try {
                await this.memoryStorage.write(changes);
            }
            catch (e) {}
        }

        async assessRisk (step) {
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);
            
            // If user types in message, restart without iterating round counter
            if (step.result) {
                if (treatment.civility == true) {
                    var msg = "Bitte **triff deine Auswahl** und klicke auf **OK**. Bitte nutze dafür nicht den Chat.";
                } else {
                    var msg = "**Triff deine Auswahl** und klicke auf **OK**. Nutze dafür nicht den Chat.";
                }
                
                await sendWithDelay(msg, step);
                // Set repeat flag 
                user[userID].riskData.repeat = true;
                // Dialog abbrechen und Schritt wiederholen
                return await step.replaceDialog('riskAssessment', userID);
            }

            // Retrieve choice object from Adaptive JSON Card
            var choice = step.context.activity.value;
            console.log("Hier sollte choice objekt kommen");
            console.log(choice);
                        
            // Key extrahieren, Nummer abschneiden und in Zahl umwandeln (Welche Karte wurde benutzt?)
            var roundPlayed = Object.keys(choice)[0];
            // If user doesn't make a choice, restart without iterating round counter
            if (!roundPlayed) {
                if (treatment.civility == true) {
                    var msg = "Bitte **triff deine Auswahl** und klicke auf **OK**.";
                } else {
                    var msg = "**Triff deine Auswahl** und klicke auf **OK**.";
                }
                
                await sendWithDelay(msg, step);
                // Set repeat flag 
                user[userID].riskData.repeat = true;
                // Dialog abbrechen und Schritt wiederholen
                return await step.replaceDialog('riskAssessment', userID);
            } else {
                roundPlayed = parseInt(roundPlayed.substr(6,roundPlayed.length));
            }
            
            console.log("hello hier sollte round counter kommen:");
            console.log(user[userID].riskData.roundCounter);

            // Überprüfen, ob Nutzer eine bereits verwendete Karte benutzt
            if (roundPlayed < user[userID].riskData.roundCounter) {
                if (treatment.civility == true) {
                    var msg = `Für Runde ${roundPlayed} hast du bereits eine Wahl getroffen, bitte neuste Runde spielen.`;
                } else {
                    var msg = `Für Runde ${roundPlayed} hast du bereits eine Wahl getroffen. Spiel die neuste Runde.`;
                }
                await sendWithDelay(msg, step);

                // Set repeat flag 
                user[userID].riskData.repeat = true;
                // Dialog abbrechen und Schritt wiederholen
                return await step.replaceDialog('riskAssessment', userID);
            // Case-Switch nötig, da JSON Cards Output statisch zurückgeben und eine Unterscheidung zwischen den Returns der Karten nötig ist (choice1-10)
            } else {
                switch (user[userID].riskData.roundCounter) {
                    case 1:
                        choice = choice.choice1;
                        break;
                    case 2:
                        choice = choice.choice2;
                        break;
                    case 3:
                        choice = choice.choice3;
                        break;
                    case 4:
                        choice = choice.choice4;
                        break;      
                    case 5:
                        choice = choice.choice5;
                        break; 
                    case 6:
                        choice = choice.choice6;
                        break; 
                    case 7:
                        choice = choice.choice7;
                        break; 
                    case 8:
                        choice = choice.choice8;
                        break; 
                    case 9:
                        choice = choice.choice9;
                        break; 
                    case 10:
                        choice = choice.choice10;
                        break; 
                }
                
            }

            console.log(user[userID].riskData.roundCounter);

            console.log(choice);
            // If user didn't make choice, reprompt
            if (choice.localeCompare("Bitte wählen") == 0) {
                if (treatment.civility == true) {
                    var msg = "Du hast keine eindeutige Wahl getroffen. Bitte erneut wählen.";
                } else {
                    var msg = "Du hast keine eindeutige Wahl getroffen. Wähle erneut.";
                }
                await sendWithDelay(msg, step);

                // Set repeat flag 
                user[userID].riskData.repeat = true;
                // Dialog abbrechen und Schritt wiederholen
                return await step.replaceDialog('riskAssessment', userID);
            }
            // Save choice
            if (!user[userID].riskData.choices) {
                // Create array if it doesn't exist yet
                user[userID].riskData.choices = [];
                user[userID].riskData.choices.push(choice);
            } else {
                user[userID].riskData.choices.push(choice);
            }
            // Make choice transparent for user
            var msg = `Du hast dich in **Runde ${roundPlayed}** für **Spiel ${choice}** entschieden.`;
            await sendWithDelay(msg, step);

           
            // Repeat until all games are played or until B is played
            if (user[userID].riskData.roundCounter < 10 && !choice.localeCompare("A")) {
                user[userID].riskData.roundCounter++;

                // Write userData to DB
                changes[userID] = user[userID];
                try {
                    await this.memoryStorage.write(changes);
                }
                catch (e) {}

                // Start next round
                return await step.replaceDialog('riskAssessment', userID);
            } else {
                // Tag risk assessment as complete
                user[userID].riskData.riskAssessmentComplete = true;
                // Assess risk behavior based on Holt and Laury (2002)
                // How many safe choices (A) were made by the user?
                var safeChoices = roundPlayed - 1;
                switch (safeChoices) {
                    case 0:
                        user[userID].riskData.riskDescription = "höchst risikoliebend";
                        break;
                    case 1:
                        user[userID].riskData.riskDescription = "höchst risikoliebend";
                        break;
                    case 2:
                        user[userID].riskData.riskDescription = "sehr risikoliebend";
                        break;
                    case 3:
                        user[userID].riskData.riskDescription = "risikoliebend";
                        break;
                    case 4:
                        user[userID].riskData.riskDescription = "risikoneutral";
                        break;      
                    case 5:
                        user[userID].riskData.riskDescription = "leicht risikoavers";
                        break; 
                    case 6:
                        user[userID].riskData.riskDescription = "risikoavers";
                        break; 
                    case 7:
                        user[userID].riskData.riskDescription = "sehr risikoavers";
                        break; 
                    case 8:
                        user[userID].riskData.riskDescription = "höchst risikoavers";
                        break; 
                    case 9:
                        user[userID].riskData.riskDescription = "bleib besser im Bett";
                        break; 
                    case 10:
                        user[userID].riskData.riskDescription = "bleib besser im Bett";
                        break; 
                }

                // Write userData to DB
                changes[userID] = user[userID];
                try {
                    await this.memoryStorage.write(changes);
                }
                catch (e) {}

                // End dialog
                if (treatment.selfReference == true && treatment.rememberName == true && treatment.civility == true) {
                    var msg = `Vielen Dank ${user[userID].name}, **ich habe dein Risikoverhalten nun analysiert**. Die verbale Bezeichnung deines Risikoverhaltens lautet: **${user[userID].riskData.riskDescription}**.`; 
                } else {
                    var msg = `**Dein Risikoverhalten wurde nun analysiert**. Die verbale Bezeichnung deines Risikoverhaltens lautet: **${user[userID].riskData.riskDescription}**.`;
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
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);
            
            if (!user[userID].investData.repeat){
                if (treatment.selfReference == true){
                    var msg = "Da nun alle von dir relevanten Daten erfasst sind und dein Risikoprofil ermittelt ist, können wir uns zusammen um deine **Investitionsentscheidung** kümmern. Du hast ein Budget von **3000 Geldeinheiten** zur Verfügung.";
                } else {
                    var msg = "Da nun alle von dir relevanten Daten erfasst sind und dein Risikoprofil ermittelt ist, kommt als nächster Schritt die **Investitionsentscheidung**. Du hast ein Budget von **3000 Geldeinheiten** zur Verfügung.";
                }
                
                await sendWithDelay(msg, step);

            }
            await delay("In welcher Branche möchtest du dein Investment tätigen?", step).then(async function() { 
                return await step.prompt('choicePrompt', "In welcher Branche möchtest du dein Investment tätigen?", ['Automobilindustrie', 'Halbleiterindustrie', 'Gesundheitsbranche', 'Andere Branche']); 
            });
            
        }
        async sendInstructions (step) {
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // Reprompt if user doesn't choose appropriate industry from experiment's scenario description
            if (step.result.value.localeCompare("Halbleiterindustrie") != 0) {
                if (treatment.selfReference == true) {
                    var msg = `Entschuldigung, ${user[userID].name}, diese Funktion ist leider zum aktuellen Zeitpunkt noch nicht verfügbar. Bitte entscheide dich für eine andere Branche.`;
                } else {
                    var msg = `Diese Funktion ist zum aktuellen Zeitpunkt nicht verfügbar. Entscheide dich für eine andere Branche.`;
                }
                await sendWithDelay(msg, step);

                user[userID].investData.repeat = true;

                // Write userData to DB
                changes[userID] = user[userID];
                try {
                    await this.memoryStorage.write(changes);
                }
                catch (e) {}

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
                return await step.prompt('textPrompt', "Hast du alles verstanden?");
            });

        }
        async furtherInformation (step) {
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            var validation = await validateInput(step.result, yesno);

            // If user didn't say "Yes", count it as "No"
            if (!validation) {
                validation = "Nein";
            }

            // Does user ask for further information?
            if (validation.localeCompare("Nein") == 0) {
                if (treatment.selfReference == true) {
                    var msg = "Tut mir leid, dass ich mich nicht eindeutig ausgedrückt habe. Ich werde versuchen, es noch ein wenig besser zu erklären.";
                    await sendWithDelay(msg, step);
                    var msg = "Ich präsentiere dir gleich drei Faktenblätter zu den vorselektierten Unternehmen. Du kannst dir dann selbst ein Bild der Unternehmen machen.";
                    await sendWithDelay(msg, step);
                    var msg = "Anschließend gebe ich dir eine Empfehlung, in welches Unternehmen ich an deiner Stelle investieren würde. Ob du dieser Entscheidung folgst, bleibt dir überlassen.";
                    await sendWithDelay(msg, step);
                    await delay("Bereit für die Unternehmensdaten?", step).then(async function() { 
                        return await step.prompt('textPrompt', "Bereit für die Unternehmensdaten?");
                    });
                } else {
                    var msg = "Hier erneut ein paar Informationen zu deinem besseren Verständnis.";
                    await sendWithDelay(msg, step);
                    var msg = "Dir werden nun drei Faktenblätter zu den vorselektierten Unternehmen präsentiert. Du kannst dir dann selbst ein Bild der Unternehmen machen.";
                    await sendWithDelay(msg, step);
                    var msg = "Anschließend bekommst du eine Empfehlung, in welches Unternehmen du laut dem Robo-Advisory System investieren solltest. Ob du dieser Entscheidung folgst, bleibt dir überlassen.";
                    await sendWithDelay(msg, step);
                    await delay("Bereit für die Unternehmensdaten?", step).then(async function() { 
                        return await step.prompt('textPrompt', "Bereit für die Unternehmensdaten?");
                    });
                }               
            } else {
                // Skip this dialog
                return await step.next();
            }
        }
        async presentCompanyInfo (step) {
            /// Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // Create array if it doesn't exist yet
            if (!user[userID].investData.order) {
                user[userID].investData.order = [];
            }

            // Create random order and save order to investmentData
            var arr = ["0", "1", "2"];
            for (var i = 1; i <= 3; i++){
                user[userID].investData.order.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
            }

            // Present Adaptive cards in a carousel in random order
            let messageWithCarouselOfCards = MessageFactory.carousel([
                CardFactory.adaptiveCard(factSheet[user[userID].investData.order[0]]),
                CardFactory.adaptiveCard(factSheet[user[userID].investData.order[1]]),
                CardFactory.adaptiveCard(factSheet[user[userID].investData.order[2]]),
            ],"Hier die Unternehmensdaten. Nimm dir ausreichend Zeit, diese zu lesen.");
            await step.context.sendActivity(messageWithCarouselOfCards);

            // Write userData to DB
            changes[userID] = user[userID];
            try {
                await this.memoryStorage.write(changes);
            }
            catch (e) {}

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
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // Make randomized recommendation 
            if (treatment.selfReference == true) {
                var msg = `Basierend auf meinen vergangenen Erfahrungen halte ich \
                sowohl die **${investmentData.companies[user[userID].investData.order[0]]}** als auch die **${investmentData.companies[user[userID].investData.order[2]]}** für **überbewertet**. \
                Die **${investmentData.companies[user[userID].investData.order[1]]}** halte ich dagegen für **unterbewertet**. \
                Das Ergebnis deiner **Risikoverhaltensanalyse** passt außerdem zum Unternehmensprofil der **${investmentData.companies[user[userID].investData.order[1]]}**. Aufgrund dessen \
                empfehle ich dir, in die **${investmentData.companies[user[userID].investData.order[1]]}** zu investieren.`;
                await sendWithDelay(msg, step);
            } else {
                var msg = `Basierend auf vergangenen Erfahrungen wird \
                sowohl die **${investmentData.companies[user[userID].investData.order[0]]}** als auch die **${investmentData.companies[user[userID].investData.order[2]]}** für **überbewertet** gehalten. \
                Die **${investmentData.companies[user[userID].investData.order[1]]}** wird als **unterbewertet** eingestuft. \
                Das Ergebnis deiner **Risikoverhaltensanalyse** passt außerdem zum Unternehmensprofil der **${investmentData.companies[user[userID].investData.order[1]]}**. Aufgrund dessen \
                wird dir vom Robo-Advisory System empfohlen, in die **${investmentData.companies[user[userID].investData.order[1]]}** zu investieren.`;
                await sendWithDelay(msg, step);
            }

            // Write userData to DB
            changes[userID] = user[userID];
            try {
                await this.memoryStorage.write(changes);
            }
            catch (e) {}

            // Continue to next dialog step
            return await step.next();
        }
        async captureInvestmentDecision (step) {
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // Let user make decision with the help of a heroCard with buttons
            const reply = { type: ActivityTypes.Message };

            // Create dynamic buttons with the same order that was randomly generated before
            const buttons = [
                { type: ActionTypes.ImBack, title: investmentData.companies[user[userID].investData.order[0]], value: investmentData.companies[user[userID].investData.order[0]] },
                { type: ActionTypes.ImBack, title: investmentData.companies[user[userID].investData.order[1]], value: investmentData.companies[user[userID].investData.order[1]] },
                { type: ActionTypes.ImBack, title: investmentData.companies[user[userID].investData.order[2]], value: investmentData.companies[user[userID].investData.order[2]] }
            ];

            // Add buttons and text to hero card
            const card = CardFactory.heroCard('', undefined, buttons, { text: '' });
            var msg = "In **welches Unternehmen** möchtest du dein vorhandenes Investitionsbudget von **3000 Geldeinheiten** investieren? Du wirst in einem Jahr an dem **Gewinn** oder **Verlust** des Unternehmens beteiligt werden.";
            await sendWithDelay(msg, step);
            // Add card to reply and send
            reply.attachments = [card];
            await step.context.sendActivity(reply);
        }
        async saveInvestmentDecision (step) {
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // Save choice
            user[userID].investData.choice = step.result;
            
            // Determine, if user followed advisor or not and reply accordingly
            if (user[userID].investData.choice.localeCompare(investmentData.companies[user[userID].investData.order[1]]) == 0) {
                await step.context.sendActivity();
                user[userID].investData.follow = true;
                
                // Write userData to DB
                changes[userID] = user[userID];
                try {
                    await this.memoryStorage.write(changes);
                }
                catch (e) {}

                // Inform user and prompt for waiting a fictive year
                if (treatment.civility == true) {
                    var msg = `Du hast dich dafür entschieden, in die **${user[userID].investData.choice}** zu investieren! Vielen Dank, dass du unseren Service genutzt hast und danke für dein Vertrauen.`;
                } else {
                    var msg = `Du hast dich dafür entschieden, in die **${user[userID].investData.choice}** zu investieren!`;
                }

                await sendWithDelay(msg, step);

                var msg = "Nun heißt es warten, bis die Aktienkurse sich verändern. Ob du Gewinn oder Verlust gemacht hast, wirst du später erfahren."


                await delay(msg, step).then(async function() { 
                    return await step.prompt('choicePrompt', msg , ['Beratung abschließen']);
                });
                
            } else {
                user[userID].investData.follow = false;

                //Write userData to DB
                changes[userID] = user[userID];
                try {
                    await this.memoryStorage.write(changes);
                }
                catch (e) {}

                // Inform user and prompt for waiting a fictive year
                if (treatment.civility == true) {
                    var msg = `Du hast dich dafür entschieden, in die **${user[userID].investData.choice}** zu investieren! Vielen Dank, dass du unseren Service genutzt hast.`;
                } else {
                    var msg = `Du hast dich dafür entschieden, in die **${user[userID].investData.choice}** zu investieren!`;
                }
                await sendWithDelay(msg, step);

                var msg = "Nun heißt es warten, bis die Aktienkurse sich verändern. Ob du Gewinn oder Verlust gemacht hast, wirst du später erfahren."

                await delay(msg, step).then(async function() { 
                    return await step.prompt('choicePrompt', msg , ['Abschließen']);
                });
               
            }
        }

        async finishAdvisory (step) {
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);
            
            // Route to endDialog
            return await step.replaceDialog('endDialog', userID);
        }


        async prepareStockPrep (step) {
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            try {
                if(user[userID].name) {
                    console.log("Nutzerdaten gefunden");
                }
            }
            catch (e) {
                await await step.context.sendActivity("Leider sind keine Nutzerdaten bekannt.");
            }

            // Welcome user again
            if (treatment.rememberName == true) {
                var msg = `Hallo und willkommen zurück, ${user[userID].name}. Ein Jahr ist vergangen.`;
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

            var msg = "Bereit?"

                await delay(msg, step).then(async function() { 
                    return await step.prompt('choicePrompt', msg , ['Weiter']);
                });
        }
            
        async presentStock (step) {
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // Randomly assign stock price charts to companies
            var arr = ["0", "1", "2", "3"];
            var allOutcomes = ["win1", "win2", "loss1", "loss2"];
            var outcomes = [];
            var arrHelp = [];
            // Fill arrHelp with three random entries from arr ([0,1,2,3])
            for (var i = 1; i <= 3; i++) {
                arrHelp.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
            }
            // Map random arrHelp to allOutcomes and save them in outcomes array (18 possibilities)
            for (var i = 0; i < 3; i++) {
                outcomes.push(allOutcomes[arrHelp[i]]);
            }

            // Transform outcomes to verbal statements and save result in investmentData
            var statements = [];
            for (var i = 0; i < 3; i++) {
                if (outcomes[i].localeCompare("win1") == 0) {
                    statements[i] = `Der Wert der **${investmentData.companies[user[userID].investData.order[i]]}** hat sich um 33% **erhöht**.`
                    user[userID].investData.win1 = investmentData.companies[user[userID].investData.order[i]];
                } else if (outcomes[i].localeCompare("win2") == 0) {
                    statements[i] = `Der Wert der **${investmentData.companies[user[userID].investData.order[i]]}** hat sich um 17% **erhöht**.`
                    user[userID].investData.win2 = investmentData.companies[user[userID].investData.order[i]];
                } else if (outcomes[i].localeCompare("loss1") == 0) {
                    statements[i] = `Der Wert der **${investmentData.companies[user[userID].investData.order[i]]}** hat sich um 17% **verringert**.`
                    user[userID].investData.loss1 = investmentData.companies[user[userID].investData.order[i]];
                } else if (outcomes[i].localeCompare("loss2") == 0) {
                    statements[i] = `Der Wert der **${investmentData.companies[user[userID].investData.order[i]]}** hat sich um 33% **verringert**.`
                    user[userID].investData.loss2 = investmentData.companies[user[userID].investData.order[i]];
                }
            }

                    

            // Present stock price charts in a carousel
            var resultChart1 = "" + investmentData.companies[user[userID].investData.order[0]].toLowerCase().replace(/\s/g, '') + "_" + outcomes[0];
            var resultChart2 = "" + investmentData.companies[user[userID].investData.order[1]].toLowerCase().replace(/\s/g, '') + "_" + outcomes[1];
            var resultChart3 = "" + investmentData.companies[user[userID].investData.order[2]].toLowerCase().replace(/\s/g, '') + "_" + outcomes[2];

            let messageWithCarouselOfCharts = MessageFactory.carousel([
                this.getStockPriceAttachment(resultChart1),
                this.getStockPriceAttachment(resultChart2),
                this.getStockPriceAttachment(resultChart3),
            ],"");
            var msg = "So haben sich die Aktienkurse der Unternehmen **relativ zu ihrem Wert von vor einem Jahr** entwickelt:";
            await sendWithDelay(msg, step);  
            await step.context.sendActivity(messageWithCarouselOfCharts);

            // Create Statement
            var statement = "";
            for (var i = 0; i < 3; i++) {
                statement = "" + statement + "\n" + statements[i];
            }

            // Write userData to DB
            changes[userID] = user[userID];
            try {
                await this.memoryStorage.write(changes);
            }
            catch (e) {}

            // Interrupt flow until user klicks continue
            await delay(statement, step).then(async function() { 
                return await step.prompt('choicePrompt', statement, ['Weiter']);
            });
            
            
        }


        async presentPayout (step) {
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            
            
            // Determine user's payout, send information to user and save in investmentData
            if (user[userID].investData.choice.localeCompare(user[userID].investData.win1) == 0) {
                var msg = `Du hast in die **${user[userID].investData.choice}** investiert. Deine Investitionssumme von 3000 Geldeinheiten hat sich somit auf **4000 Geldeinheiten erhöht** und du hast **1000 Geldeinheiten Gewinn gemacht**.`;
                await sendWithDelay(msg, step);  
                user[userID].investData.payout = "Du bekommst 7000 Geldeinheiten = 7,00€ ausgezahlt.";
            } else if (user[userID].investData.choice.localeCompare(user[userID].investData.win2) == 0) {
                var msg = `Du hast in die **${user[userID].investData.choice}** investiert. Deine Investitionssumme von 3000 Geldeinheiten hat sich somit auf **3500 Geldeinheiten erhöht** und du hast **500 Geldeinheiten Gewinn gemacht**.`;
                await sendWithDelay(msg, step);
                user[userID].investData.payout = "Du bekommst 6500 Geldeinheiten = 6,50€ ausgezahlt.";
            } else if (user[userID].investData.choice.localeCompare(user[userID].investData.loss1) == 0) {
                var msg = `Du hast in die **${user[userID].investData.choice}** investiert. Deine Investitionssumme von 3000 Geldeinheiten hat sich somit auf **2500 Geldeinheiten verringert** und du hast **500 Geldeinheiten Verlust gemacht**.`;
                await sendWithDelay(msg, step);
                user[userID].investData.payout = "Du bekommst 5500 Geldeinheiten = 5,50€ ausgezahlt.";
            } else if (user[userID].investData.choice.localeCompare(user[userID].investData.loss2) == 0) {
                var msg = `Du hast in die **${user[userID].investData.choice}** investiert. Deine Investitionssumme von 3000 Geldeinheiten hat sich somit auf **2000 Geldeinheiten verringert** und du hast **1000 Geldeinheiten Verlust gemacht**.`;
                await sendWithDelay(msg, step);
                user[userID].investData.payout = "Du bekommst 5000 Geldeinheiten = 5,00€ ausgezahlt.";
            }

            // Praise / Apologize 
            if (treatment.apologizePraise) {
                try {
                    var choiceTemp = user[userID].investData.choice;
                }
                catch (e) {}

                if (choiceTemp.localeCompare(user[userID].investData.win1) == 0 || choiceTemp.localeCompare(user[userID].investData.win2) == 0) {
                    var female = "weiblich";
                    if (female.localeCompare(user[userID].gender) == 0) {
                        var msg = `Herzlichen Glückwunsch, **${user[userID].name}**, zu deinem Gewinn! **Du hast dein Können als Investorin bewiesen**.`
                    }
                        var msg = `Herzlichen Glückwunsch, **${user[userID].name}**, zu deinem Gewinn! **Du hast dein Können als Investor bewiesen**.`
                } else {
                    var msg = `${user[userID].name}, es tut mir wirklich Leid, dass die Aktienkurse deiner Aktie gefallen sind. Dein nächstes Investment wird sich bestimmt besser entwickeln.`
                }
                await sendWithDelay(msg, step);
            }

            // Write userData to DB
            changes[userID] = user[userID];
            try {
                await this.memoryStorage.write(changes);
            }
            catch (e) {}

            // Loop main menu or go to next dialog (depending on test mode)
            if (testing == true) {
                // Return to main dialog                
                return await step.beginDialog('mainMenu', userID);
            } else {
                return await step.replaceDialog('endDialog', userID);
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
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            try {
                var endRepeatTemp = user[userID].endRepeat;
            }
            catch (e) { 
                await step.context.sendActivity(e); 
                endRepeatTemp = "";
            }

            if (!endRepeatTemp) {
                user[userID].endRepeat = true;
                if (treatment.rememberName == true) {
                    var msg = `Danke, ${user[userID].name}, für deine Zeit. Der Beratungsprozess ist nun abgeschlossen.`;
                } else {
                    var msg = `Der Beratungsprozess ist nun abgeschlossen.`;
                }
                await sendWithDelay(msg, step);
                
            }
                        
            // Write userData to DB
            changes[userID] = user[userID];
            try {
                await this.memoryStorage.write(changes);
            }
            catch (e) {}

            // Inform user and pause dialog
            await delay("Bis bald!", step).then(async function() { 
                return await step.prompt('textPrompt', "Bis bald!");
            });
            
        }
        async loopEnd (step) {
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            // Inform user
            if (treatment.rememberName == true) {
                var msg = `${user[userID].name}, der Beratungsprozess ist nun wirklich abgeschlossen!`;
            } else {
                var msg = `Der Beratungsprozess ist nun wirklich abgeschlossen!`;
            }
            
            await sendWithDelay(msg, step);


            // Loop dialog
            return await step.replaceDialog('endDialog', userID);
        }

        // Dialogs for payout display

        async displayPayout (step) {
            console.log("Display Payout");
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);


            var msg = `Hallo ${user[userID].name}. Am Ausgang kannst du dir deine Bezahlung von ${user[userID].investData.payout} abholen.` ;
            await sendWithDelay(msg, step);
        }

        async startBot (step) {
            console.log("Bot waiting for user to start");    
            return await step.prompt('textPrompt', "");
        }

        async startDialog (step) {
            // Get userID from prior step and clear changes
            var userID = step.options;
            var changes = {};

            // Read UserData from DB
            var user = await this.memoryStorage.read([userID]);

            try{ var firstUserMessage = step.result }
            catch(e) { console.log(e) }

            console.log("First user message: " + firstUserMessage);
            if (firstUserMessage.toLowerCase() == "start") {
                console.log("Bot Started by user");
                try { 
                    if (user[userID].name) {
                        if (treatment.rememberName == true) {
                            await step.context.sendActivity(`Hinweis: Nutzer ${user[userID].name} erkannt.`);
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
        let dc = await this.dialogSet.createContext(turnContext);
        
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
                        var userID = turnContext.activity.membersAdded[idx].id;
                        //var userID = "1234512"
                        //console.log("UserID: " + this.userID);
                        
                        // Route to correct dialog depending on treatment and bot type
                        if (treatment.initiation == true && advisoryDialog == true) {
                            await dc.beginDialog('welcome', userID);
                        } else if (treatment.initiation == false) {
                            await dc.beginDialog('startBot', userID);
                        } else if (treatment.initiation == true && advisoryDialog == false && payoutDialog == true) {
                            await dc.beginDialog('investmentResult', userID)
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
        //await this.userState.saveChanges(turnContext);

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
    } catch(err) { /*console.log("Delay(): User hasn't sent choice prompt answer that needs to be read.")*/ }   
    
       
    
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
        console.log("INFO: Delay calculated: %s, %s | %s, %s -> %s", previousMessageComplexity, readingTime, botResponseComplexity, typingTime, responseTime);

        

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
        console.log('A match with ' + match[1]*100 + '% accuracy was found: ' + match[0])
    } else {
        console.log('The user input "' + input + '" could not be matched.')
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