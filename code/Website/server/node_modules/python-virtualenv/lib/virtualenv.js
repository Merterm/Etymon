'use strict';

var exec = require('child_process').exec,
  defer = require('q').defer,
  /** The default path into which the python virtualenv will be installed */
  defaultEnvPath = __dirname + '/../env ';


/**
 * A common method to execute a shell command. The execution is wrapped in a promise that will be
 * rejected with the output of stderr if the execution fails. Otherwise the promise resolves
 *
 * @param {string} command
 *   The shell command to execute.
 * @param {object=} options
 *   Additional options, see `child_process.exec`.
 * @returns {Q.promise}
 */
function executeCommand(command, options) {
  var deferrable = defer();

  exec(command, options, function (error, stdout) {
    if (error) {
      deferrable.reject(error);
    } else {
      deferrable.resolve(stdout);
    }
  });

  return deferrable.promise;
}

/**
 * Finds out the python version of the system-wide python.
 *
 * @returns {Q.promise}
 */
function systemInterpreterVersion() {
  return executeCommand('python --systemInterpreterVersion').then(function(stdout){
    return stdout.trim().substr(7);
  });
}


/**
 * Installs the virtualenv. It also installs pip, so it is really easy to installEnv additional python
 * packages.
 *
 * If you don't want to installEnv it
 *
 * @returns {Q.promise}
 */
function installEnv(envPath) {
  var command = [
    // Execute the virtualenv-script
    'python ', __dirname, '/../virtualenv/virtualenv.py ',
    // Into the target or default target
    envPath || defaultEnvPath,
    // And don't installEnv setuptools/pip, this will not work.
    '--no-setuptools'
  ];

  return executeCommand(command.join('')).then(function(){
    return executeScript(__dirname + '/../pip/contrib/get-pip.py').then(function(success){
      return success;
    }, function(error){
      return error;
    });
  });
}


/**
 * Installs the python package identified by the given string. The string is passed to pip, see
 * http://www.pip-installer.org/en/latest/reference/pip_install.html for detailed information.
 *
 * If you want to use another virtualenv than the default virtualenv or if you did not installEnv
 * the virtualenv in the default directory, you can pass in the path to the virtualenv as the second
 * parameter.
 *
 * @param {string} packageName
 * @param {string=} envPath
 *
 */
function installPackage(packageName, envPath) {
  return executeBin('pip install ' + packageName, envPath);
}


/**
 * Executes the python script with the given path in the installed virtualenv. If you want to use
 * another virtualenv than the default virtualenv or if you did not installEnv the virtualenv in the
 * default directory, you can pass in the path to the virtualenv as the second parameter.
 *
 * Please note that this function does not validate the input and you could execute malicious
 * commands in the shell.
 *
 * @param {string} scriptPath
 * @param {object=} options
 * @param {string=} pythonEnv
 * @returns {Q.promise}
 */
function executeScript(scriptPath, options, pythonEnv) {
  return executeCommand((pythonEnv || __dirname + '/../env/') + 'bin/python ' + scriptPath, options);
}


/**
 * Executes the installed package script. If you want to use another virtualenv than the default
 * virtualenv or if you did not installEnv the virtualenv in the default directory, you can pass in
 * the path to the virtualenv as the second parameter.
 *
 * Please note that this function does not validate the input and you could execute malicious
 * commands in the shell.
 *
 * @param {string} bin
 * @param {object=} options
 * @param {string=} pythonEnv
 * @returns {Q.promise}
 */
function executeBin(bin, options, pythonEnv) {
  return executeCommand((pythonEnv || __dirname + '/../env/') + 'bin/' + bin, options);
}


exports.systemInterpreterVersion = systemInterpreterVersion;
exports.installEnv = installEnv;
exports.executeBin = executeBin;
exports.executeScript = executeScript;
exports.installPackage = installPackage;
