// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// bot.js is your bot's main entry point to handle incoming activities.

const { ActivityTypes, ActionTypes } = require('botbuilder');
const { NumberPrompt, ChoicePrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CardFactory } = require('botbuilder');
const { MessageFactory } = require('botbuilder');
const { ShowTypingMiddleware } = require('botbuilder');
const path = require('path');
const fs = require('fs');



// The accessor names for the conversation data and user profile state property accessors.
const CONVERSATION_DATA_PROPERTY = 'conversationData';
const USER_DATA_PROPERTY = 'userData';
const RISK_DATA_PROPERTY = 'userRiskData';
const INVESTMENT_DATA_PROPERTY = 'userInvestmentData';


//import { DirectLine } from 'botframework-directlinejs';
const { DirectLine } = require('botframework-directlinejs');

var directLine = new DirectLine({
    secret: "gEhdp5OpmP0.cwA.BTU.KhaAI6r0Ay72nO5DEgsA5XYx2GLWafFMwmydG0nFvdA",
    //token: /* or put your Direct Line token here (supply secret OR token, not both) ,
    //domain: /* optional: if you are not using the default Direct Line endpoint, e.g. if you are using a region-specific endpoint, put its full URL here 
    //webSocket: /* optional: false if you want to use polling GET to receive messages. Defaults to true (use WebSocket). ,
    //pollingInterval: /* optional: set polling interval in milliseconds. Default to 1000,
}); 


//const typing = new ShowTypingMiddleware(1000,2500);


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


// Static data for UserData assessment
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
                await step.context.sendActivity("Ich habe dein Alter leider nicht verstanden.");
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
    major: {
        tag: "Studiengang",
        prompt: "Was studierst du? **(Bitte Zahl oder Titel eingeben)**",
        prompt_other: "Dein Studiengang war wohl **nicht in der Liste**. Wie heißt dein Studiengang?",
    },
}


// Array of education
const educations = ['Sekundarstufe', 'Bachelor', 'Master', 'Promotion', 'Sonstiges'];

// Array of majors
const majors = ['WING / INWI / TVWL', 'Maschinenbau', 'Informatik', 'Mathematik', 'Ich studiere nicht'];

// Additional properties relevant for user data 
const userDataProperties = {
    display: {value: ""},
}


// Data for Investment decision
const investmentData = {
    companies: ["ACG GmbH", "Breen GmbH", "Plus GmbH"],
    /* order: [],
    choice: undefined,
    follow: undefined,

    repeat: false,

    // Determines which company follows which stock price chart
    win1: undefined, // Factor: 1.214
    win2: undefined, // Factor: 1.143
    loss1: undefined, // Factor: 0.857
    loss2: undefined, // Factor: 0.785

    payout: undefined */
}

// Determines treatment
const treatment = {
    // Humanization treatment on / off
    humanization: false,
    // Self-Promotion treatment on / off
    selfPromotion: false,
}

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
        // Properties for UserState     
        this.welcomedUserProperty = userState.createProperty(WELCOMED_USER);
        this.userData = userState.createProperty(USER_DATA_PROPERTY);
        this.riskData = userState.createProperty(RISK_DATA_PROPERTY);
        this.investmentData = userState.createProperty(INVESTMENT_DATA_PROPERTY);

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
               // Return await step.prompt('choicePrompt', "Wähle eine der folgenden Optionen aus", ['Order Dinner', 'Reserve a table', 'Profil erstellen']);
               return await step.prompt('choicePrompt', "**Bitte wähle** eine der folgenden Optionen aus", ['Profil erstellen', 'Profil anzeigen', 'Profil löschen', 'Risikoverhalten', 'Investment']);
            },
            async function (step) {
                // Handle the user's response to the previous prompt and branch the dialog.
                if (step.result.value.match(/Profil erstellen/ig)) {
                    return await step.beginDialog('createProfile');
                }
                if (step.result.value.match(/Profil anzeigen/ig)) {
                    return await step.beginDialog('displayProfile');
                }
                if (step.result.value.match(/Profil löschen/ig)) {
                    return await step.beginDialog('deleteProfile');
                }
                if (step.result.value.match(/Risikoverhalten/ig)) {
                    return await step.beginDialog('riskAssessment');
                }
                if (step.result.value.match(/Investment/ig)) {
                    return await step.beginDialog('investmentDecision');
                }
            },
            async function (step) {
                // Calling replaceDialog will loop the main menu
                return await step.replaceDialog('mainMenu');
            }
        ]));


        // Create dialog for prompting user for profile data
        this.dialogSet.add(new WaterfallDialog('createProfile', [
            this.promptForName.bind(this),
            this.promptForAge.bind(this),
            this.promptForGender.bind(this),
            this.promptForEducation.bind(this),
            this.promptForMajor.bind(this),
            this.promptForOtherMajor.bind(this),
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
            this.presentStock.bind(this),
            this.presentPayout.bind(this),
        ]));

        // Enddialog
        this.dialogSet.add(new WaterfallDialog('endDialog', [
            this.end.bind(this),
            this.loopEnd.bind(this),
        ]));

        // Create dialog for displaying payout to the user
        this.dialogSet.add(new WaterfallDialog('displayPayout', [
            this.displayPayout.bind(this),
        ]));

        console.log("Constructor end");

    } // End of constructor

    // Function for welcoming user
    async welcomeUser (step) {
        // Workaround to ensure the welcome event is only triggered once (webchat related issue: https://github.com/Microsoft/BotFramework-WebChat/issues/1371)
        // Retrieve user object from UserState storage

        //const user = await this.userData.get(step.context, {});

        //console.log(user.welcomeUser);

        //if (!user.welcomedUser) {
            // Welcome the user
            if (treatment.humanization == true && treatment.selfPromotion == true) {
                await step.context.sendActivity("Hallo, ich bin **Charles**, dein persönlicher **Investmentberater**. Ich begleite dich durch den Beratungsprozess.");
                await step.context.sendActivity("Meine hochmoderne künstliche Intelligenz erlaubt es mir, äußerst präzise **Vorhersagen für Finanzanlagen**, basierend auf Daten aus der Vergangenheit zu treffen.");
            } else if (treatment.humanization == true && treatment.selfPromotion == false) {
                await step.context.sendActivity("Hallo, ich bin **Charles**, dein persönlicher **Investmentberater**. Ich begleite dich durch den Beratungsprozess.");
            } else if (treatment.humanization == false && treatment.selfPromotion == true) {
                await step.context.sendActivity("Hallo, ich bin ein **Robo-Advisor**. Ich begleite dich durch den Beratungsprozess.");
                await step.context.sendActivity("Meine hochmoderne künstliche Intelligenz erlaubt es mir, äußerst präzise **Vorhersagen für Finanzanlagen** basierend auf Daten aus der Vergangenheit zu treffen.");
            } else if (treatment.humanization == false && treatment.selfPromotion == false) {
                await step.context.sendActivity("Hallo, ich bin ein **Robo-Advisor**. Ich begleite dich durch den Beratungsprozess.");
            }
        //} else {
        //    return await step.endDialog();
        //}

        // Set flag to prevent user being welcomed twice
        //user.welcomedUser = true;

        // Give user object back to UserState storage
        //await this.userData.set(step.context, user);

        if (testing == true) {
            // Start main dialog                
            return await step.beginDialog('mainMenu');
        } else {
            return await step.beginDialog('createProfile');
        }
    }

    // Functions for creating UserProfile 
        async promptForName (step) {
            console.log("Name Prompt");
            // Retrieve user object from UserState storage
            const user = await this.userData.get(step.context, {});

            // Before prompting, check if value already exists
            if(!user.name){
                if (user.deleted == true) {
                    await step.context.sendActivity("Ich stelle dir nun die gleichen Fragen erneut.");
                } else {
                    await step.context.sendActivity("Ich stelle dir nun ein paar Fragen, um deine wichtigsten Daten zu erfassen.");
                }
                return await step.prompt('textPrompt', userData.name.prompt);
            } else {
                return await step.next();
            }
        }
        async promptForAge (step) {
            console.log("Age Prompt");
            // Retrieve user object from UserState storage
            const user = await this.userData.get(step.context, {});
            // Before saving entry, check if it already exists
            if(!user.name){
                user.name = step.result;
                // Give user object back to UserState storage
                await this.userData.set(step.context, user);
                await step.context.sendActivity(`Hallo **${user.name}**!`)
            }
            // Before prompting, check if value already exists
            if(!user.age){
                return await step.prompt('textPrompt', userData.age.prompt);
            } else {
                return await step.next();
            }
        }
        async promptForGender (step) {
            console.log("Gender Prompt");
            // Retrieve user object from UserState storage
            const user = await this.userData.get(step.context, {});
            // Before saving entry, check if it already exists
            if(!user.age){
                // Validate entered age
                let validated = await userData.age.validate(step)
                if (validated){
                    user.age = userData.age.recognize(step);
                    // Give user object back to UserState storage
                    await this.userData.set(step.context, user);
                    // Before prompting, check if value already exists
                    if(!user.gender){
                        return await step.prompt('choicePrompt', userData.gender.prompt, ['Männlich', 'Weiblich', 'Sonstiges']);
                    } else {
                        return await step.next();
                    }
                } else if (!validated) {
                    // Prompt for age again
                    return await step.replaceDialog("createProfile");
                }
            } else {
                    return await step.next();
            }
        }
        async promptForEducation (step) {
            console.log("Education Prompt");
            // Retrieve user object from UserState storage
            const user = await this.userData.get(step.context, {});
            // Before saving entry, check if it already exists
            if(!user.gender){
                user.gender = step.result.value;
                // Give user object back to UserState storage
                await this.userData.set(step.context, user);
            }
            // Before prompting, check if value already exists
            if (!user.education){
                const user = await this.userData.get(step.context, {});
                console.log(user);
                // Prompt for highest education with list of education options
                return await step.prompt('choicePrompt', userData.education.prompt, educations);
            } else {
                return await step.next();
            }
        }
        async promptForMajor (step) {
            console.log("Major Prompt");
            // Retrieve user object from UserState storage
            const user = await this.userData.get(step.context, {});
            console.log(user);
            // Before saving entry, check if it already exists
            if(!user.education){
                user.education = step.result.value;
                // Give user object back to UserState storage
                await this.userData.set(step.context, user);
                console.log(user);
            }
            // Before prompting, check if value already exists
            if (!user.major){
                // Copy List of majors and add "Other" entry
                let majorsOther = majors.slice(0,majors.length);
                majorsOther.push("Einen anderen Studiengang");
                return await step.prompt('choicePrompt', userData.major.prompt, majorsOther);
            } else {
                return await step.next();
            }
        }
        async promptForOtherMajor (step) {
            console.log("Major Other");
            // Retrieve user object from UserState storage
            const user = await this.userData.get(step.context, {});
            if (!user.major){
                // Check if entered major is part of majors array
                if (majors.indexOf(step.result.value) == -1){
                    return await step.prompt('textPrompt', userData.major.prompt_other);
                } else {
                    // If not, save response to profile
                    user.major = step.result.value;
                    // Give user object back to UserState storage
                    await this.userData.set(step.context, user);
                    return await step.next();
                }
            } else {
                // If major is already in profile, skip this step
                return await step.next();
            }
        }
        async completeProfile (step) {
            console.log("Complete");
            // Retrieve user object from UserState storage
            const user = await this.userData.get(step.context, {});
            // Before saving entry, check if it already exists
            if (!user.major){
                user.major = step.result;
                // Give user object back to UserState storage
                await this.userData.set(step.context, user);
            }
            if (!user.complete){
                user.complete = true;
                // Give user object back to UserState storage
                await this.userData.set(step.context, user);
                await step.context.sendActivity(`Super, dein Profil ist nun vollständig.`);
            } else {
                await step.context.sendActivity(`Du hast dein Profil bereits ausgefüllt.`);
            }
            if (testing == true) {
                // Return to main dialog                
                return await step.beginDialog('mainMenu');
            } else {
                return await step.beginDialog('displayProfile');
            }
        }

        // Function for displaying user profile
        async displayProfile (step) {
            // Retrieve user object from UserState storage
            const user = await this.userData.get(step.context, {});
            // If Profile not completed, end dialog and return to main menu
            if (!user.complete){
                await step.context.sendActivity("Dein Profil ist noch nicht vollständig.");
                return await step.replaceDialog('createProfile');
            }
            // Create array from individual user data
            var userArr = Object.values(user);
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
            await step.context.sendActivity("Das sind deine Profildaten:");
            await step.context.sendActivity(userDataProperties.display.value);
            // Clear display string
            userDataProperties.display.value = "";

            // Prompt user, if profile is correct
            return await step.prompt('choicePrompt', "Sind deine Daten korrekt?", ['Ja', 'Nein']);

            
        }
        async isProfileCorrect (step) {

            // If profile incorrect, delete profile and recreate
            if (step.result.value.localeCompare("Nein") == 0) {

                // Delete Profile 
                await step.context.sendActivity("Bitte erstelle dein Profil erneut.");
                return await step.replaceDialog('deleteProfile');
            }
            // Loop main menu or go to next dialog (depending on test mode)
            if (testing == true) {
                // Return to main dialog                
                return await step.beginDialog('mainMenu');
            } else {
                return await step.beginDialog('riskAssessment');
            }
        }

        // Function for deleting user profile
        async deleteProfile (step) {
            // Retrieve user object from UserState storage
            const user = await this.userData.get(step.context, {});
            // Iterate through user data and delete entries
            Object.keys(user).forEach(function(key) {
                user[key] = "";
            })
            // Clear "complete" Tag
            user.complete = false;
            user.deleted = true;
            // Give user object back to UserState storage
            await this.userData.set(step.context, user);
            // End dialog
            await step.context.sendActivity("Dein Profil wurde gelöscht.");
            
            // Loop main menu or go to next dialog (depending on test mode)
            if (testing == true) {
                // Return to main dialog                
                return await step.beginDialog('mainMenu');
            } else {
                // Recreate profile
                return await step.beginDialog('createProfile');
            }
        }



        // Functions for Risk Assessment

        async presentRiskCards (step) {
            // Retrieve user object from UserState storage
            const userRiskData = await this.riskData.get(step.context, {});
            // Überprüfen, ob Spiel bereits läuft, falls nicht, neue Runde starten 
            if (!userRiskData.roundCounter) {
                userRiskData.roundCounter = 1;
                await step.context.sendActivity("Bevor wir uns deinem Investmentportfolio widmen, werde ich zunächst **dein Risikoverhalten** ermitteln.");
                if (treatment.selfPromotion == true) {
                    await step.context.sendActivity("Durch die Nutzung eines **hochmodernen Algorithmus**, der auf Basis vieler anonymer Nutzerdaten erstellt wurde, \
                    kann ich dein Risikoverhalten **sehr präzise** ermitteln. Hierfür werde ich ein kleines Spiel mit dir spielen.");
                } else {
                    await step.context.sendActivity("Um dein Risikoverhalten zu analysieren, werde ich ein kleines Spiel mit dir spielen.");
                }
                await step.context.sendActivity("Ich präsentiere dir nun bis zu zehn mal hintereinander zwei Lotteriespiele, von denen du dich **jeweils für eines entscheiden** musst.");
                await step.context.sendActivity("Jedes Spiel hat zwei mögliche Ausgänge, die jeweils eine festgelegte Wahrscheinlichkeit und \
                eine festgelegte Auszahlung haben.");                   
            }

            // If RiskAssessment already finished, notify user and go back to main menu
            if (userRiskData.riskAssessmentComplete == true) {
                await step.context.sendActivity(`Dein Risikoverhalten wurde bereits ermittelt. Du bist **${userRiskData.riskDescription}**.`);
                if (testing == true) {
                    // Return to main dialog                
                    return await step.beginDialog('mainMenu');
                } else {
                    return await step.beginDialog('investmentDecision');
                }
                // Only present card, if round is not a repeated round
            } else if (userRiskData.repeat == true){
                userRiskData.repeat = false;
                await step.context.sendActivity("");
            } else {
                // Present Adaptive Card 1-10 for gathering User Input
                await step.context.sendActivity({
                    text: `Runde  ${userRiskData.roundCounter}`,
                    attachments: [CardFactory.adaptiveCard(riskCard[userRiskData.roundCounter])]
                });
            }
        }
        async assessRisk (step) {
            // Retrieve user object from UserState storage
            const userRiskData = await this.riskData.get(step.context, {});
            const user = await this.userData.get(step.context, {});
            // If user types in message, restart without iterating round counter
            if (step.result) {
                await step.context.sendActivity("Bitte **triff deine Auswahl** und klicke auf **OK**. Bitte nutze dafür nicht den Chat.");
                // Set repeat flag 
                userRiskData.repeat = true;
                // Dialog abbrechen und Schritt wiederholen
                return await step.replaceDialog('riskAssessment');
            }

            // Retrieve choice object from Adaptive JSON Card
            var choice = step.context.activity.value;
            console.log(choice);
                        
            // Key extrahieren, Nummer abschneiden und in Zahl umwandeln (Welche Karte wurde benutzt?)
            var roundPlayed = Object.keys(choice)[0];
            // If user doesn't make a choice, restart without iterating round counter
            if (!roundPlayed){
                await step.context.sendActivity("Bitte **triff deine Auswahl** und klicke auf **OK**.");
                // Set repeat flag 
                userRiskData.repeat = true;
                // Dialog abbrechen und Schritt wiederholen
                return await step.replaceDialog('riskAssessment');
            } else {
                roundPlayed = parseInt(roundPlayed.substr(6,roundPlayed.length));
            }
            

            // Überprüfen, ob Nutzer eine bereits verwendete Karte benutzt
            if (roundPlayed < userRiskData.roundCounter) {
                await step.context.sendActivity(`Für Runde ${roundPlayed} hast du bereits eine Wahl getroffen, bitte neuste Runde spielen.`);
                // Set repeat flag 
                userRiskData.repeat = true;
                // Dialog abbrechen und Schritt wiederholen
                return await step.replaceDialog('riskAssessment');
            // Case-Switch nötig, da JSON Cards Output statisch zurückgeben und eine Unterscheidung zwischen den Returns der Karten nötig ist (choice1-10)
            } else {
                switch (userRiskData.roundCounter) {
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
            // If user didn't make choice, reprompt
            if (choice.localeCompare("Bitte wählen") == 0) {
                await step.context.sendActivity("Du hast keine eindeutige Wahl getroffen. Bitte erneut wählen.")
                // Set repeat flag 
                userRiskData.repeat = true;
                // Dialog abbrechen und Schritt wiederholen
                return await step.replaceDialog('riskAssessment');
            }
            // Save choice
            if (!userRiskData.choices) {
                // Create array if it doesn't exist yet
                userRiskData.choices = [];
                userRiskData.choices.push(choice);
            } else {
                userRiskData.choices.push(choice);
            }
            // Make choice transparent for user
            await step.context.sendActivity(`Du hast dich in **Runde ${roundPlayed}** für **Spiel ${choice}** entschieden.`)


            // Repeat until all games are played or until B is played
            if (userRiskData.roundCounter < 10 && !choice.localeCompare("A")) {
                userRiskData.roundCounter++;
                return await step.replaceDialog('riskAssessment');
            } else {
                // Tag risk assessment as complete
                userRiskData.riskAssessmentComplete = true;
                // Assess risk behavior based on Holt and Laury (2002)
                // How many safe choices (A) were made by the user?
                var safeChoices = roundPlayed - 1;
                switch (safeChoices) {
                    case 0:
                        userRiskData.riskDescription = "höchst risikoliebend";
                        break;
                    case 1:
                        userRiskData.riskDescription = "höchst risikoliebend";
                        break;
                    case 2:
                        userRiskData.riskDescription = "sehr risikoliebend";
                        break;
                    case 3:
                        userRiskData.riskDescription = "risikoliebend";
                        break;
                    case 4:
                        userRiskData.riskDescription = "risikoneutral";
                        break;      
                    case 5:
                        userRiskData.riskDescription = "leicht risikoavers";
                        break; 
                    case 6:
                        userRiskData.riskDescription = "risikoavers";
                        break; 
                    case 7:
                        userRiskData.riskDescription = "sehr risikoavers";
                        break; 
                    case 8:
                        userRiskData.riskDescription = "höchst risikoavers";
                        break; 
                    case 9:
                        userRiskData.riskDescription = "bleib besser im Bett";
                        break; 
                    case 10:
                        userRiskData.riskDescription = "bleib besser im Bett";
                        break; 
                }
                // Give user object back to UserState storage
                await this.riskData.set(step.context, userRiskData);
                // End dialog
                if (treatment.selfPromotion == true) {
                    await step.context.sendActivity(`Vielen Dank ${user.name}, **ich habe dein Risikoverhalten mit einer Genauigkeit von 98% ermittelt**. Die verbale Bezeichnung deines Risikoverhaltens lautet: **${userRiskData.riskDescription}**.`)
                } else {
                    await step.context.sendActivity(`Vielen Dank ${user.name}, **ich habe dein Risikoverhalten nun analysiert**. Die verbale Bezeichnung deines Risikoverhaltens lautet: **${userRiskData.riskDescription}**.`)
                }

                // Loop main menu or go to next dialog (depending on test mode)
                if (testing == true) {
                    // Return to main dialog                
                    return await step.beginDialog('mainMenu');
                } else {
                    return await step.beginDialog('investmentDecision');
                }
            }
        }


        // Functions for Investment Game

        async promptForIndustry (step) {
            // Retrieve user object from UserState storage
            const userInvestData = await this.investmentData.get(step.context, {});
            if (!userInvestData.repeat){
                await step.context.sendActivity("Da nun alle von dir relevanten Daten erfasst sind und dein Risikoprofil ermittelt ist, können wir mit der **Investitionsentscheidung** beginnen. Du hast ein Budget von **7,00€** zur Verfügung.");
                if (treatment.selfPromotion == true) {
                    await step.context.sendActivity("Um dich bei der Entscheidung bestmöglich zu unterstützen, setze ich auf einen Machine-Learning Algorithmus, der sich als äußerst robust erwiesen hat.");
                }
            }
            return await step.prompt('choicePrompt', "In welcher Branche möchtest du dein Investment tätigen?", ['Automobilindustrie', 'Halbleiterindustrie', 'Gesundheitsbranche', 'Andere Branche']); 
        }
        async sendInstructions (step) {
            // Retrieve user object from UserState storage
            const userInvestData = await this.investmentData.get(step.context, {});
            const user = await this.userData.get(step.context, {});
            // Reprompt if user doesn't choose appropriate industry from experiment's scenario description
            if (step.result.value.localeCompare("Halbleiterindustrie") != 0) {
                await step.context.sendActivity(`Entschuldigung, ${user.name}, diese Funktion ist leider zum aktuellen Zeitpunkt noch nicht verfügbar. Bitte entscheide dich für eine andere Branche.`);
                userInvestData.repeat = true;
                return await step.replaceDialog('investmentDecision');
            }
            // Give user object back to UserState storage
            await this.investmentData.set(step.context, userInvestData);
            // Send instructions and ask if user understood
            await step.context.sendActivity("Wir werden nun deinem Ziel nachkommen, dein Investitionsportfolio um eine Investition in der **Halbleiterindustrie** zu erweitern.");
            await step.context.sendActivity("Um dir Arbeit zu ersparen, habe ich die drei vielversprechendsten Unternehmen der Branche **vorselektiert**. Ich werde dir gleich die wichtigsten Informationen zu den drei Unternehmen zukommen lassen, um dir eine Entscheidungsgrundlage zu geben.");
            await step.context.sendActivity("Anschließend werde ich dir eine **Empfehlung** geben, die auf deinem Risikoprofil und meiner Einschätzung der Unternehmen basieren.");
            return await step.prompt('choicePrompt', "Hast du alles verstanden?", ['Ja', 'Nein']);
        }
        async furtherInformation (step) {
            // Retrieve user object from UserState storage
            const userInvestData = await this.investmentData.get(step.context, {});
            console.log(step.result.value);
            // Does user ask for further information?
            if (step.result.value.localeCompare("Nein") == 0) {
                await step.context.sendActivity("Tut mir leid, dass ich mich nicht eindeutig ausgedrückt habe. Ich werde versuchen, es noch ein wenig besser zu erklären.");
                await step.context.sendActivity("Ich präsentiere dir gleich drei Faktenblätter zu den vorselektierten Unternehmen. Du kannst dir dann selbst ein Bild der Unternehmen machen.");
                if (treatment.selfPromotion == true) {
                    await step.context.sendActivity("Anschließend gebe ich dir eine Empfehlung, in welches Unternehmen ich an deiner Stelle investieren würde. Die Empfehlung basiert auf den Ergebnissen meines Machine-Learning Algorithmus. Ob du dieser Entscheidung folgst, bleibt dir überlassen.");
                } else {
                    await step.context.sendActivity("Anschließend gebe ich dir eine Empfehlung, in welches Unternehmen ich an deiner Stelle investieren würde. Ob du dieser Entscheidung folgst, bleibt dir überlassen.");
                }
                return await step.prompt('textPrompt', "Ich würde dir nun die Unternehmensdaten präsentieren.");
            } else {
                // Skip this dialog
                return await step.next();
            }
        }
        async presentCompanyInfo (step) {
            // Retrieve user object from UserState storage
            const userInvestData = await this.investmentData.get(step.context, {});

            // Create array if it doesn't exist yet
            if (!userInvestData.order) {
                userInvestData.order = [];
            }

            // Create random order and save order to investmentData
            var arr = ["0", "1", "2"];
            for (var i = 1; i <= 3; i++){
                userInvestData.order.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
            }

            // Present Adaptive cards in a carousel in random order
            let messageWithCarouselOfCards = MessageFactory.carousel([
                CardFactory.adaptiveCard(factSheet[userInvestData.order[0]]),
                CardFactory.adaptiveCard(factSheet[userInvestData.order[1]]),
                CardFactory.adaptiveCard(factSheet[userInvestData.order[2]]),
            ],"Hier die Unternehmensdaten. Bitte nimm dir genug Zeit, diese zu lesen.");
            await step.context.sendActivity(messageWithCarouselOfCards);

            // Give user object back to UserState storage
            await this.investmentData.set(step.context, userInvestData);

            // Ask user for any input to continue with next dialog
            if (treatment.selfPromotion == true) {
                await step.context.sendActivity("Bitte melde dich, wenn du alles gelesen hast, und wir mit meiner fundierten Empfehlung fortfahren können.");
            } else {
                await step.context.sendActivity("Bitte melde dich, wenn du alles gelesen hast, und wir mit meiner Empfehlung fortfahren können.");
            }
            
        }
        async recommendInvestment (step) {
            // Retrieve user object from UserState storage
            const userInvestData = await this.investmentData.get(step.context, {});
            const user = await this.userData.get(step.context, {});
            // Make randomized recommendation 
            if (treatment.selfPromotion == true) {
                await step.context.sendActivity(`Basierend auf meinem erprobten Machine-Learning Algorithmus, mit welchem ich die Unternehmensdaten geprüft habe, halte ich \
                sowohl die **${investmentData.companies[userInvestData.order[0]]}** als auch die **${investmentData.companies[userInvestData.order[2]]}** für **überbewertet**. \
                Die **${investmentData.companies[userInvestData.order[1]]}** halte ich dagegen für **unterbewertet**. \
                Das Ergebnis deiner **Risikoverhaltensanalyse** passt außerdem zum Unternehmensprofil der **${investmentData.companies[userInvestData.order[1]]}**. Aufgrund dessen \
                empfehle ich dir, in die **${investmentData.companies[userInvestData.order[1]]}** zu investieren.`);
            } else {
                await step.context.sendActivity(`Basierend auf meinen vergangenen Erfahrungen halte ich \
                sowohl die **${investmentData.companies[userInvestData.order[0]]}** als auch die **${investmentData.companies[userInvestData.order[2]]}** für **überbewertet**. \
                Die **${investmentData.companies[userInvestData.order[1]]}** halte ich dagegen für **unterbewertet**. \
                Das Ergebnis deiner **Risikoverhaltensanalyse** passt außerdem zum Unternehmensprofil der **${investmentData.companies[userInvestData.order[1]]}**. Aufgrund dessen \
                empfehle ich dir, in die **${investmentData.companies[userInvestData.order[1]]}** zu investieren.`);
            }
            // Give user object back to UserState storage
            await this.investmentData.set(step.context, userInvestData);

            // Continue to next dialog step
            return await step.next();
        }
        async captureInvestmentDecision (step) {
            // Retrieve user object from UserState storage
            const userInvestData = await this.investmentData.get(step.context, {});
            // Let user make decision with the help of a heroCard with buttons
            const reply = { type: ActivityTypes.Message };

            // Create dynamic buttons with the same order that was randomly generated before
            const buttons = [
                { type: ActionTypes.ImBack, title: investmentData.companies[userInvestData.order[0]], value: investmentData.companies[userInvestData.order[0]] },
                { type: ActionTypes.ImBack, title: investmentData.companies[userInvestData.order[1]], value: investmentData.companies[userInvestData.order[1]] },
                { type: ActionTypes.ImBack, title: investmentData.companies[userInvestData.order[2]], value: investmentData.companies[userInvestData.order[2]] }
            ];

            // Add buttons and text to hero card
            const card = CardFactory.heroCard('', undefined, buttons, { text: '' });
            await step.context.sendActivity("In **welches Unternehmen** möchtest du dein vorhandenes Investitionsbudget von **7,00€** investieren? Du wirst in einem Jahr an dem **Gewinn** oder **Verlust** des Unternehmens beteiligt werden.");
            // Add card to reply and send
            reply.attachments = [card];
            await step.context.sendActivity(reply);
        }
        async saveInvestmentDecision (step) {
            // Retrieve user object from UserState storage
            const userInvestData = await this.investmentData.get(step.context, {});
            // Save choice
            userInvestData.choice = step.result;
            
            // Determine, if user followed advisor or not and reply accordingly
            if (userInvestData.choice.localeCompare(investmentData.companies[userInvestData.order[1]]) == 0) {
                await step.context.sendActivity();
                userInvestData.follow = true;
                // Give user object back to UserState storage
                await this.investmentData.set(step.context, userInvestData);
                // Inform user and prompt for waiting a fictive year
                return await step.prompt('choicePrompt', `Du hast dich dafür entschieden, in die **${userInvestData.choice}** zu investieren! Danke für dein Vertrauen.`, ['Ein Jahr warten']);
            } else {
                userInvestData.follow = false;
                // Give user object back to UserState storage
                await this.investmentData.set(step.context, userInvestData);
                // Inform user and prompt for waiting a fictive year
                return await step.prompt('choicePrompt', `Du hast dich dafür entschieden, in die **${userInvestData.choice}** zu investieren!`, ['Ein Jahr warten']);
            }
        }
        async presentStock (step) {
            // Retrieve user object from UserState storage
            const userInvestData = await this.investmentData.get(step.context, {});
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
                    statements[i] = `Der Wert der **${investmentData.companies[userInvestData.order[i]]}** hat sich um 21,4% **erhöht**.`
                    userInvestData.win1 = investmentData.companies[userInvestData.order[i]];
                } else if (outcomes[i].localeCompare("win2") == 0) {
                    statements[i] = `Der Wert der **${investmentData.companies[userInvestData.order[i]]}** hat sich um 14,3% **erhöht**.`
                    userInvestData.win2 = investmentData.companies[userInvestData.order[i]];
                } else if (outcomes[i].localeCompare("loss1") == 0) {
                    statements[i] = `Der Wert der **${investmentData.companies[userInvestData.order[i]]}** hat sich um 14,3% **verringert**.`
                    userInvestData.loss1 = investmentData.companies[userInvestData.order[i]];
                } else if (outcomes[i].localeCompare("loss2") == 0) {
                    statements[i] = `Der Wert der **${investmentData.companies[userInvestData.order[i]]}** hat sich um 21,5% **verringert**.`
                    userInvestData.loss2 = investmentData.companies[userInvestData.order[i]];
                }
            }

            // Inform user
            await step.context.sendActivity("Ein Jahr ist vergangen. Sehen wir uns an, wie sich die Aktienkurse der Unternehmen entwickelt haben.");            

            // Present stock price charts in a carousel
            var resultChart1 = "" + investmentData.companies[userInvestData.order[0]].toLowerCase().replace(/\s/g, '') + "_" + outcomes[0];
            var resultChart2 = "" + investmentData.companies[userInvestData.order[1]].toLowerCase().replace(/\s/g, '') + "_" + outcomes[1];
            var resultChart3 = "" + investmentData.companies[userInvestData.order[2]].toLowerCase().replace(/\s/g, '') + "_" + outcomes[2];

            let messageWithCarouselOfCharts = MessageFactory.carousel([
                this.getStockPriceAttachment(resultChart1),
                this.getStockPriceAttachment(resultChart2),
                this.getStockPriceAttachment(resultChart3),
            ],"");
            await step.context.sendActivity("So haben sich die Aktienkurse der Unternehmen **relativ zu ihrem Wert von vor einem Jahr** entwickelt:");
            await step.context.sendActivity(messageWithCarouselOfCharts);

            // Create Statement
            var statement = "";
            for (var i = 0; i < 3; i++) {
                statement = "" + statement + "\n" + statements[i];
            }

            // Give user object back to UserState storage
            await this.investmentData.set(step.context, userInvestData);

            // Interrupt flow until user klicks continue
            return await step.prompt('choicePrompt', statement, ['Weiter']);
        }
        async presentPayout (step) {
            // Retrieve user object from UserState storage
            const userInvestData = await this.investmentData.get(step.context, {});
            const user = await this.userData.get(step.context, {});

            // Determine user's payout, send information to user and save in investmentData
            if (userInvestData.choice.localeCompare(userInvestData.win1) == 0) {
                await step.context.sendActivity(`Du hast in die **${userInvestData.choice}** investiert. Deine Investitionssumme von 7,00€ hat sich somit auf **8,50€ erhöht** und du hast **1,50€ Gewinn gemacht**.`);
                userInvestData.payout = "11,50€";
            } else if (userInvestData.choice.localeCompare(userInvestData.win2) == 0) {
                await step.context.sendActivity(`Du hast in die **${userInvestData.choice}** investiert. Deine Investitionssumme von 7,00€ hat sich somit auf **8,00€ erhöht** und du hast **1,00€ Gewinn gemacht**.`);
                userInvestData.payout = "11,00€";
            } else if (userInvestData.choice.localeCompare(userInvestData.loss1) == 0) {
                await step.context.sendActivity(`Du hast in die **${userInvestData.choice}** investiert. Deine Investitionssumme von 7,00€ hat sich somit auf **6,00€ verringert** und du hast **1,00€ Verlust gemacht**.`);
                userInvestData.payout = "9,00€";
            } else if (userInvestData.choice.localeCompare(userInvestData.loss2) == 0) {
                await step.context.sendActivity(`Du hast in die **${userInvestData.choice}** investiert. Deine Investitionssumme von 7,00€ hat sich somit auf **5,50€ verringert** und du hast **1,50€ Verlust gemacht**.`);
                userInvestData.payout = "8,50€";
            }

            // Loop main menu or go to next dialog (depending on test mode)
            if (testing == true) {
                // Return to main dialog                
                return await step.beginDialog('mainMenu');
            } else {
                return await step.replaceDialog('endDialog');
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
            // Retrieve user object from UserState storage
            const user = await this.userData.get(step.context, {});
            if (!user.endRepeat) {
                await step.context.sendActivity(`Danke, ${user.name}, für deine Zeit. Der Beratungsprozess ist nun abgeschlossen.`)
                user.endRepeat = true;
            }
                        
            // Give user object back to UserState storage
            await this.userData.set(step.context, user);
            // Inform user and pause dialog
            return await step.prompt('textPrompt', "Bis bald!");
        }
        async loopEnd (step) {
            // Retrieve user object from UserState storage
            const user = await this.userData.get(step.context, {});
            // Inform user
            await step.context.sendActivity(`${user.name}, der Beratungsprozess ist nun wirklich abgeschlossen!`);
            // Give user object back to UserState storage
            await this.userData.set(step.context, user);
            // Loop dialog
            return await step.replaceDialog('endDialog');
        }

        // Dialogs for payout display

        async displayPayout (step) {
            console.log("Display Payout");
            // Retrieve user object from UserState storage
            const user = await this.userData.get(step.context, {});
    
            await step.context.sendActivity(`Hallo **${user.name}**! Du erhältst am Ausgang **${user.payout}`)
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
                        // Start the dialog.
                        console.log("User added");
                        const user = await this.userData.get(step.context, {});

                        console.log(user.welcomeUser);
                
                        if (!user.welcomedUser) {
                        await dc.beginDialog('welcome');
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

// Im folgenden Beispiel wird jede Nachricht des Benutzers einer Liste hinzugefügt. Die Datenstruktur, die die Liste enthält, wird in Ihrem Speicher gespeichert.
async function logMessageText(storage, context, userState) {
    let utterance = context.activity.text;
    
    let id = "1234"
    
    try {
        // Read from the storage.
        let storeItems = await storage.read(["UtteranceLog"]);
        let storeUserState = await storage.read(["UserLog_" + id]);

        // Check the result.
        var utteranceLog = storeItems["UtteranceLog"];
        var userLog = storeUserState["UserLog_" + id];

        // Sample part
        if (typeof (utteranceLog) != 'undefined') {
            // The log exists so we can write to it.
            storeItems["UtteranceLog"].UtteranceList.push(utterance);

            try {
                await storage.write(storeItems)
                console.log('Successful write to utterance log.');
            } catch (err) {
                console.log(`Write failed of UtteranceLog: ${err}`);
            }

         } else {
            console.log(`need to create new utterance log`);
            storeItems["UtteranceLog"] = { UtteranceList: [`${utterance}`], "eTag": "*" }

            try {
                await storage.write(storeItems)
                console.log('Successful write to log.');
            } catch (err) {
                console.log(`Write failed: ${err}`);
            }
        }

        // UserState part
        if (typeof (userLog) != 'undefined') {
            // The log exists so we can write to it.
            storeUserState["UserLog_" + id].UtteranceList.push(userState);

            try {
                await storage.write(storeUserState)
                console.log('Successful write to user log.');
            } catch (err) {
                console.log(`Write failed of UserLog: ${err}`);
            }

         } else {
            console.log(`need to create new user log`);
            storeUserState["UserLog_" + id] = { UtteranceList: [`${userState}`], "eTag": "*" }

            try {
                await storage.write(storeUserState)
                console.log('Successful write to UserLog.');
            } catch (err) {
                console.log(`Write failed: ${err}`);
            }
        }
    } catch (err) {
        console.log(`Read rejected. ${err}`);
    };
    return id;
}
