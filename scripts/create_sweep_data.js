var fs = require('fs');
var parse = require('csv-parse');

var parser = parse({delimiter: ','}, function(err, data){
  console.log(data);
});

console.log(__dirname+'/Beacons.csv');
fs.createReadStream(__dirname+'/Beacons.csv').pipe(parser);