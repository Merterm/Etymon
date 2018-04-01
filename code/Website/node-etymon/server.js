let sys = require('util')
let exec = require('child_process').exec;
let child;
const express = require('express')
const app = express()
const bodyParser = require('body-parser');

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
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
