// http://nodejs.org/api.html#_child_processes
// import sys module
let sys = require('util')
let exec = require('child_process').exec;
let child;

const argv = require('yargs').argv;

// variables
let word = argv.c || "closet";
let bash_cmnd = "grep \": " + word + "\\t\" etymwn.tsv";

//unzip
exec("unzip etymwn-20130208.zip");

// executes bash command
child = exec(bash_cmnd, function (error, stdout, stderr) {
  if (error !== null) {
    console.log('Word not found!');
  }
  else {
    console.log(stdout);
  }
});

//remove unzipped files
exec("rm etymwn.tsv readme.txt");
