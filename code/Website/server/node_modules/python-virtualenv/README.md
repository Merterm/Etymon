# python-virtualenv

`python-virtualenv` is a small package that creates virtualenvs, so you can include a python with
custom packages in your project and that you do not pollute your global python installation.


## Usage

```js
virtualenv = require('python-virtualenv');
// Install a virtualenv for the current project.
virtualenv.installEnv();
```


### Install a package
```js
virtualenv.installPackage('django');
```

### Execute a script
```js
virtualenv.executeScript('foo.py').then(
  function successHandler(stdout){
    console.log(stdout);
  },
  function errorHandler(stderr){
    console.log(stderr);
  }
);
```
