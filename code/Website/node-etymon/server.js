let sys = require('util')
let exec = require('child_process').exec;
let child;
const express = require('express')
const app = express()
const bodyParser = require('body-parser');
var cytoscape = require('cytoscape');

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(allowCrossDomain);
app.set('view engine', 'ejs')

// gets the root page
app.get('/', function (req, res) {
  //unzip
  exec("unzip etymwn-20130208.zip");
  //res.render('index');
})

app.post('/search', function (req, res) {
  console.log("search");
  console.log(req.body.word);
  // variables
  let word = req.body.word || "closet";
  let bash_cmnd = "grep \": " + word + "\\t\" etymwn.tsv";

  // executes bash command
  child = exec(bash_cmnd, function (error, stdout, stderr) {
    if (error !== null) {
      console.log('inside if');
      res.send({etymology: null, error: 'Couldn\'t find the word :('});
      console.log('after send');
    }
    else {
      console.log('inside else');
      let etymology = stdout;
      res.send({etymology: stdout, error: null});
      console.log('after send');
    }
  });
})

app.post('/lstm', function (req, res) {
  console.log("inside lstm");
  console.log(req.body.word);
  // variables
  let word = req.body.word || "closet";
  let bash_cmnd = "cd tensorflow; source ./bin/activate; python generate_text.py";

  // executes bash command
  child = exec(bash_cmnd, function (error, stdout, stderr) {
    if (error !== null) {
      console.log('inside if');
      res.send({hallucination: null, error: 'Couldn\'t find the word :('});
      console.log('after send');
    }
    else {
      console.log('inside else');
      res.send({hallucination: stdout, error: null});
      console.log('after send');
    }
  });
})

app.listen(8080, function () {
  console.log('Example app listening on port 8080!')
})
