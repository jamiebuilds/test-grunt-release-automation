var Promise = require('bluebird');
var semver = require('semver');
var fs = require('fs');
var path = require('path');
var inquirer = require('inquirer');
var Repo = require('gitty')('./');

var checkStatusOfRepo = function () {
  return new Promise(function (resolve, reject) {
    Repo.status(function (err, status) {
      console.log(status.staged.length);
      console.log(status.not_staged);
      if (status.staged.length !== 0 || status.not_staged !== 0) {
        reject('Please commit all files before performing a release.');
      } else {
        resolve();
      }
    });
  });
};

var getRepoTags = function () {
  return new Promise(function (resolve, reject) {
    Repo.tags(function (err, tags) {
      console.log(tags);
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

    var nextVersion = semver.inc(currentVersion, type);

    if (!semver.valid( nextVersion )) {
      reject('Current version is invalid.');
    }

    inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Is version ' + nextVersion + ' okay?',
    }], function (answers) {
      if (answers.confirm) {
        resolve(nextVersion);
      } else {
        reject('Cancelled.');
      }
    });
  });
};

var editChangelog = function (nextVersion) {
  return new Promise(function (resolve, reject) {
    var editor = require('child_process').spawn('vim', ['+4', 'CHANGELOG.md'], { stdio: 'inherit' });
    editor.on('exit', function () {
      resolve(nextVersion);
    });
  });
};

var editUpgradeGuide = function (nextVersion) {
  return new Promise(function (resolve, reject) {
    var editor = require('child_process').spawn('vim', ['+3', 'UPGRADE-GUIDE.md'], { stdio: 'inherit' });
    editor.on('exit', function () {
      resolve(nextVersion);
    });
  });
};

var confirmReadyToPublish = function (nextVersion) {
  return new Promise(function (resolve, reject) {
    inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you ready to publish ' + nextVersion + '?',
    }], function (answers) {
      if (answers.confirm) {
        resolve(nextVersion);
      } else {
        reject('Cancelled.');
      }
    });
  });
};

var updateJsonFileVersion = function (file, nextVersion) {
  return new Promise(function (resolve, reject) {
    var data = require(file);

    data.version = nextVersion;
    data = JSON.stringify(data, null, 2);
    data += '\n';

    fs.writeFile(path.resolve(__dirname, file), data, function (err) {
      if (err) return reject(err);
      resolve(nextVersion);
    });
  });
};

var updatePackageJson = function (nextVersion) {
  return updateJsonFileVersion('../package.json', nextVersion);
};

var updateBowerJson = function (nextVersion) {
  return updateJsonFileVersion('../bower.json', nextVersion);
};

module.exports = function () {
  return checkStatusOfRepo()
    .then( getTypeOfRelease )
    .then( getVersion )
    .then( editChangelog )
    .then( editUpgradeGuide )
    .then( confirmReadyToPublish )
    .then( updatePackageJson )
    .then( updateBowerJson );
};
