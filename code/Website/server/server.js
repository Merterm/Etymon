let sys = require('util')
let exec = require('child_process').exec;
let child;
const express = require('express')
const app = express()
const bodyParser = require('body-parser');

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(allowCrossDomain);

app.post('/search', function (req, res) {
  console.log("search");
  console.log(req.body.word);

  // variables
  let word = req.body.word || "closet";
  let bash_cmnd = "grep \": " + word + "$(printf '\\t')\" etymon.tsv";

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
  let bash_cmnd = "cd LSTM; source ./tensorflow/bin/activate; cd trainer; python generate_text.py \"" + word + "\"; deactivate; cd ../..";

  // executes bash command
  child = exec(bash_cmnd, function (error, stdout, stderr) {
    if (error !== null) {
      res.send({etymology: null, error: error});
    }
    else {
      var halluc_word = stdout.split('\n');
      console.log("eng: " + word + "\trel:etymology\t" + halluc_word[0])
      res.send({etymology: "eng: " + word + "\trel:etymology\t" + halluc_word[0], error: null});
    }
  });
})

app.listen(8080, function () {
  console.log('Example app listening on port 8080!')
})
