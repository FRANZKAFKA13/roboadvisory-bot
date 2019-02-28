var count1 = 0;
var count2 = 0;
var count3 = 0;
var count4 = 0;
var count5 = 0;
var count6 = 0;
var count7 = 0;
var count8 = 0;
var count9 = 0;
var count10 = 0;
var count11 = 0;
var count12 = 0;
var count13 = 0;
var count14 = 0;
var count15 = 0;
var count16 = 0;
var count17 = 0;
var count18 = 0;


Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array)
        return false;

    // compare lengths - can save a lot of time 
    if (this.length != array.length)
        return false;

    for (var i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i]))
                return false;       
        }           
        else if (this[i] != array[i]) { 
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;   
        }           
    }       
    return true;
}

// Hide method from for-in loops
Object.defineProperty(Array.prototype, "equals", {enumerable: false});


for (var j = 1; j < 10000000; j++) {
    var arr = ["0", "1", "2", "3"];
    var x = [];

    for (var i = 1; i <= 3; i++) {
        x.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
    }

    if (x.equals(["0","1","2"])) {
        count1 = count1 + 1;
    }
    if (x.equals(["0","2","1"])) {
        count2 = count3 + 1;
    }
    if (x.equals(["0","1","3"])) {
        count3 = count3 + 1;
    }
    if (x.equals(["0","3","1"])) {
        count4 = count4 + 1;
    }
    if (x.equals(["0","2","3"])) {
        count5 = count5 + 1;
    }
    if (x.equals(["0","3","2"])) {
        count6 = count6 + 1;
    }
    if (x.equals(["1","2","0"])) {
        count7 = count7 + 1;
    }
    if (x.equals(["2","1","0"])) {
        count8 = count8 + 1;
    }
    if (x.equals(["3","1","0"])) {
        count9 = count9 + 1;
    }
    if (x.equals(["1","3","0"])) {
        count10 = count10 + 1;
    }
    if (x.equals(["2","3","0"])) {
        count11 = count11 + 1;
    }
    if (x.equals(["3","2","0"])) {
        count12 = count12 + 1;
    }
    if (x.equals(["2","0","1"])) {
        count13 = count13 + 1;
    }
    if (x.equals(["1","0","2"])) {
        count14 = count14 + 1;
    }
    if (x.equals(["3","0","1"])) {
        count15 = count15 + 1;
    }
    if (x.equals(["1","0","3"])) {
        count16 = count16 + 1;
    }
    if (x.equals(["2","0","3"])) {
        count17 = count17 + 1;
    }
    if (x.equals(["3","0","2"])) {
        count18 = count18 + 1;
    }
    else{
        //console.log("FEHLER");
    }
}

console.log(count1);
console.log(count2);
console.log(count3);
console.log(count4);
console.log(count5);
console.log(count6);
console.log(count7);
console.log(count8);
console.log(count9);
console.log(count10);
console.log(count11);
console.log(count12);
console.log(count13);
console.log(count14);
console.log(count15);
console.log(count16);
console.log(count17);
console.log(count18); 





