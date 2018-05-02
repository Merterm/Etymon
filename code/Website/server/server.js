let sys = require('util')
let exec = require('child_process').exec;
let virtualenv = require('python-virtualenv');
var http = require('http'); // 3. HTTP server

let child;
const express = require('express')
const app = express()
const bodyParser = require('body-parser');

// Install a virtualenv for the current project.
virtualenv.installEnv();
virtualenv.installPackage('numpy');
virtualenv.installPackage('scipy');
virtualenv.installPackage('tensorflow');
virtualenv.installPackage('keras');

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}

/**
 * Get port from environment and store in Express.
 */
var port = process.env.PORT; // 2. Using process.env.PORT
app.set('port', port);

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
  //let bash_cmnd = "cd LSTM; source ./tensorflow/bin/activate; cd trainer; python generate_text.py \"" + word + "\"; deactivate; cd ../..";

  // Execute the python script inside the virtualenv
  virtualenv.executeScript('LSTM/trainer/generate_text.py ' + word).then(
    function successHandler(stdout){
      console.log(stdout);
      var halluc_word = stdout.split('\n');
      res.send({etymology: "eng: " + word + "\trel:etymology\t" + halluc_word[0], error: null});
    },
    function errorHandler(stderr){
      console.log(stderr);
      res.send({etymology: null, error: error});
    }
  );

  /*// executes bash command
  child = exec(bash_cmnd, function (error, stdout, stderr) {
    if (error !== null) {
      res.send({etymology: null, error: error});
    }
    else {
      var halluc_word = stdout.split('\n');
      console.log("eng: " + word + "\trel:etymology\t" + halluc_word[0])
      res.send({etymology: "eng: " + word + "\trel:etymology\t" + halluc_word[0], error: null});
    }
  });*/
})

/**
 * Create HTTP server.
 */
var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);

/*app.listen(8080, function () {
  console.log('Example app listening on port 8080!')
})*/
