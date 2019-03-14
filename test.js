var string1 = "39843A"
var string2 = "39843R"

var id1 = string1.substring(0, string1.length-1);
var id2 = string2.substring(0, string2.length-1);

var mode1 = string1.substring(string1.length-1, string1.length);
var mode2 = string2.substring(string2.length-1, string2.length);

console.log(id1);
console.log(mode1);