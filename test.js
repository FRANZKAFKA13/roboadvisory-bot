
const { stringSimilarity } = require('string-similarity-js');

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
};


console.log(validateInput("", educations));