// http://nodejs.org/api.html#_child_processes
// import sys module
let sys = require('util');
let exec = require('child_process').exec;
var cytoscape = require('cytoscape');
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

var cy = cytoscape({

        elements: [ // list of graph elements to start with
          { // node a
            data: { id: 'a' }
          },
          { // node b
            data: { id: 'b' }
          },
          { // edge ab
            data: { id: 'ab', source: 'a', target: 'b' }
          }
        ],

        style: [ // the stylesheet for the graph
          {
            selector: 'node',
            style: {
              'background-color': '#666',
              'label': 'data(id)'
            }
          },

          {
            selector: 'edge',
            style: {
              'width': 3,
              'line-color': '#ccc',
              'target-arrow-color': '#ccc',
              'target-arrow-shape': 'triangle'
            }
          }
        ],

        layout: {
          name: 'grid',
          rows: 1
        }
});

//remove unzipped files
exec("rm etymwn.tsv readme.txt");
