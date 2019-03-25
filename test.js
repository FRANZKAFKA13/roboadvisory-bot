var arr = ['A','A','B'];

for (var i = 0; i < 10; i++) {
    if (typeof arr[i] === 'undefined') {
        console.log(i + "existiert nicht");
    } else {
        console.log(i + "existiert");
    }
}

console.log("hlallo")