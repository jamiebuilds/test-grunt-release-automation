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
      if (tags.indexOf('v' + NEXT_VERSION) > -1) {
        reject('Tag v' + NEXT_VERSION + ' already exists.');
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

var getUnstagedFiles = function () {
  return new Promise(function (resolve, reject) {
    Repo.status(function (err, status) {
      if (err) return reject(err);

      var files = status.not_staged.map(function (item) {
        return item.file;
      });

      resolve(files);
    });
  });
};

var addAllRepoFiles = function (files) {
  return new Promise(function (resolve, reject) {
    console.log('GIT: Adding Unstaged Files');
    Repo.add(files, function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

var commitNextVersion = function () {
  return new Promise(function (resolve, reject) {
    console.log('GIT: Commit "Release v' + NEXT_VERSION + '"');
    Repo.commit('Release v' + NEXT_VERSION, function (err, output) {
      if (err) return reject(err);
      resolve();
    });
  });
};

var tagNextVersion = function () {
  return new Promise(function (resolve, reject) {
    console.log('GIT: Tag "v' + NEXT_VERSION + '"');
    Repo.tag('v' + NEXT_VERSION, function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

var checkIfReadyToPush = function () {
  return new Promise(function (resolve, reject) {
    inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you ready to push v' + NEXT_VERSION + ' to origin?',
    }], function (answers) {
      if (answers.confirm) {
        resolve();
      } else {
        reject('Cancelled.');
      }
    });
  });
};

var getGitCredentials = function () {
  return new Promise(function (resolve, reject) {
    inquirer.prompt([{
      type: 'input',
      name: 'username',
      message: 'Whats your github username?'
    }, {
      type: 'password',
      name: 'password',
      message: 'Whats your github password?'
    }], function (answers) {
      resolve(answers);
    });
  });
};

var pushBranchToOrigin = function (credentials) {
  return new Promise(function (resolve, reject) {
    Repo.push('origin', 'master', {}, function (err) {
      if (err) return reject( err );
      resolve();
    }, credentials);
  });
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
    .then( updateBowerJson )
    .then( getUnstagedFiles )
    .then( addAllRepoFiles )
    .then( commitNextVersion )
    .then( tagNextVersion )
    .then( checkIfReadyToPush )
    .then( getGitCredentials )
    .then( pushBranchToOrigin );
};
