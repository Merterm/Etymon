let sys = require('util')
let exec = require('child_process').exec;
let child;
const express = require('express')
const app = express()
const bodyParser = require('body-parser');
var cytoscape = require('cytoscape');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs')

app.get('/', function (req, res) {
  //unzip
  exec("unzip etymwn-20130208.zip");
  res.render('index')
})

app.post('/', function (req, res) {
  console.log(req.body.word);
  // variables
  let word = req.body.word || "closet";
  let bash_cmnd = "grep \": " + word + "\\t\" etymwn.tsv";

  // executes bash command
  child = exec(bash_cmnd, function (error, stdout, stderr) {
    if (error !== null) {
      res.render('index', {etymology: null, error: 'Couldn\'t find the word :('});
    }
    else {
      let etymology = stdout;
      res.render('index', {etymology: stdout, error: null});
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
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
