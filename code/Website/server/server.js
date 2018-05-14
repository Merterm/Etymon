let sys = require('util')
let exec = require('child_process').exec;
let python_virtualenv = require('python-virtualenv');
var http = require('http'); // 3. HTTP server

var virtualenv = require("virtualenv");
var packagePath = require.resolve("./package.json")
var env = virtualenv(packagePath);

let child;
const express = require('express')
const app = express()
const bodyParser = require('body-parser');

// Install a virtualenv for the current project.
python_virtualenv.installEnv();
python_virtualenv.installPackage('numpy');
python_virtualenv.installPackage('scipy');
python_virtualenv.installPackage('tensorflow');
python_virtualenv.installPackage('keras');

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}

/**
 * Get port from environment and store in Express.
 */
//var port = process.env.PORT; // 2. Using process.env.PORT
//app.set('port', port);

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

  //Another take on virtualenv
  // This is a child_process running Python using your virtualenv. You can
  // communicate with it over stdin/stdout, etc.
  /*var child = env.spawnPython(["./LSTM/trainer/generate_text.py"]);
  child.stdout.on('data', (data) => {
    console.log(`child stdout:\n${data}`);
    var halluc_word = `${data}`.split('\n');
    res.send({etymology: "eng: " + word + "\trel:etymology\t" + halluc_word[0], error: null});
  });

  child.stderr.on('data', (data) => {
    console.error(`child stderr:\n${data}`);
  });*/

  // Execute the python script inside the virtualenv
  /*python_virtualenv.executeScript('LSTM/trainer/generate_text.py ' + word).then(
    function successHandler(stdout){
      console.log(stdout);
      var halluc_word = stdout.split('\n');
      res.send({etymology: "eng: " + word + "\trel:etymology\t" + halluc_word[0], error: null});
    },
    function errorHandler(stderr){
      console.log(stderr);
      res.send({etymology: null, error: error});
    }
  );*/

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

/**
 * Create HTTP server.
 */
//var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */
//server.listen(port);

app.listen(8080, function () {
  console.log('Example app listening on port 8080!')
})
