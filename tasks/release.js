var Promise = require('bluebird');
var semver = require('semver');
var fs = require('fs');
var path = require('path');
var inquirer = require('inquirer');
var Repo = require('gitty')('./');

var NEXT_VERSION; // todo: don't do this

var checkStatusOfRepo = function () {
  return new Promise(function (resolve, reject) {
    Repo.status(function (err, status) {
      if (status.staged.length > 0 || status.not_staged.length > 0) {
        reject('Please commit all files before performing a release.');
      } else {
        resolve();
      }
    });
  });
};

var getTypeOfRelease = function () {
  return new Promise(function (resolve, reject) {
    inquirer.prompt([{
      type : 'list',
      name : 'type',
      message : 'What kind of release is this?',
      choices : ['patch', 'minor', 'major']
    }], function (answers) {
      resolve(answers.type);
    });
  });
};

var getVersion = function (type) {
  return new Promise(function (resolve, reject) {
    var currentVersion = require('../package.json').version;

    if (!semver.valid( currentVersion )) {
      reject('Current version is invalid.');
    }

    NEXT_VERSION = semver.inc(currentVersion, type);

    if (!semver.valid( NEXT_VERSION )) {
      reject('Current version is invalid.');
    }

    inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Is version ' + NEXT_VERSION + ' okay?',
    }], function (answers) {
      if (answers.confirm) {
        resolve();
      } else {
        reject('Cancelled.');
      }
    });
  });
};

var checkForBadVersion = function () {
  return new Promise(function (resolve, reject) {
    Repo.tags(function (err, tags) {
      if (tags.indexOf(NEXT_VERSION) > -1) {
        reject('Tag ' + NEXT_VERSION + ' already exists.');
      } else {
        resolve();
      }
    });
  });
};

var editChangelog = function () {
  return new Promise(function (resolve, reject) {
    var editor = require('child_process').spawn('vim', ['CHANGELOG.md'], { stdio: 'inherit' });
    editor.on('exit', function () {
      resolve();
    });
  });
};

var editUpgradeGuide = function () {
  return new Promise(function (resolve, reject) {
    var editor = require('child_process').spawn('vim', ['UPGRADE-GUIDE.md'], { stdio: 'inherit' });
    editor.on('exit', function () {
      resolve();
    });
  });
};

var confirmReadyToPublish = function () {
  return new Promise(function (resolve, reject) {
    inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you ready to publish ' + NEXT_VERSION + '?',
    }], function (answers) {
      if (answers.confirm) {
        resolve();
      } else {
        reject('Cancelled.');
      }
    });
  });
};

var updateJsonFileVersion = function (file) {
  return new Promise(function (resolve, reject) {
    var data = require(file);

    data.version = NEXT_VERSION;
    data = JSON.stringify(data, null, 2);
    data += '\n';

    fs.writeFile(path.resolve(__dirname, file), data, function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

var updatePackageJson = function () {
  return updateJsonFileVersion('../package.json');
};

var updateBowerJson = function () {
  return updateJsonFileVersion('../bower.json');
};

module.exports = function () {
  return checkStatusOfRepo()
    .then( getTypeOfRelease )
    .then( getVersion )
    .then( checkForBadVersion )
    .then( editChangelog )
    .then( editUpgradeGuide )
    .then( confirmReadyToPublish )
    .then( updatePackageJson )
    .then( updateBowerJson );
};
