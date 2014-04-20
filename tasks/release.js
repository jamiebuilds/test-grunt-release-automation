var Promise = require('bluebird');
var semver = require('semver');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var inquirer = Promise.promisifyAll(require('inquirer'), function () {
  console.log(arguments);
});
var shell = require('shelljs');
var Repo = Promise.promisifyAll(require('gitty')('./'));

// var NEXT_VERSION; // todo: don't do this

var checkStatusOfRepo = function() {
  return Repo.statusAsync().then(function(status) {
    if (status.staged.length > 0 || status.not_staged.length > 0) {
      throw new Error('Please commit all files before performing a release.');
    }
  });
};

var getTypeOfRelease = function() {
  return new Promise(function(resolve, reject) {
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

var getVersion = function(type) {
  var self = this;
  var currentVersion = require('../package.json').version;

  if (!semver.valid( currentVersion )) {
    throw new Error('Current version is invalid.');
  }

  this.NEXT_VERSION = semver.inc(currentVersion, type);

  if (!semver.valid( this.NEXT_VERSION )) {
    throw new Error('Current version is invalid.');
  }

  return new Promise(function(resolve, reject) {
    inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Is version ' + self.NEXT_VERSION + ' okay?',
    }], function(answers) {
      if (answers.confirm) {
        resolve();
      } else {
        reject('Cancelled.');
      }
    });
  });
};

var checkForBadVersion = function() {
  return Repo.tagsAsync().then(function(tags) {
    if (tags.indexOf('v' + this.NEXT_VERSION) > -1) {
      throw new Error('Tag v' + this.NEXT_VERSION + ' already exists.');
    }
  });
};

var editChangelog = function() {
  console.log('VIM: Editting Changelog');
  return new Promise(function(resolve, reject) {
    var editor = require('child_process').spawn('vim', ['CHANGELOG.md'], { stdio: 'inherit' });
    editor.on('exit', function() {
      resolve();
    });
  });
};

var editUpgradeGuide = function() {
  console.log('VIM: Editting Upgrade Guide');
  return new Promise(function(resolve, reject) {
    var editor = require('child_process').spawn('vim', ['UPGRADE-GUIDE.md'], { stdio: 'inherit' });
    editor.on('exit', function() {
      resolve();
    });
  });
};

var confirmReadyToPublish = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you ready to publish ' + self.NEXT_VERSION + '?',
    }], function (answers) {
      if (answers.confirm) {
        resolve();
      } else {
        reject('Cancelled.');
      }
    });
  });
};

var updateJsonFileVersion = function(file) {
  var data = require(file);
  var filepath = path.resolve(__dirname, file);

  data.version = this.NEXT_VERSION;
  data = JSON.stringify(data, null, 2);
  data += '\n';

  return fs.writeFileAsync(filepath, data);
};

var updatePackageJson = function() {
  return updateJsonFileVersion('../package.json');
};

var updateBowerJson = function() {
  return updateJsonFileVersion('../bower.json');
};

var getUnstagedFiles = function() {
  return Repo.statusAsync().then(function(status) {
    return status.not_staged.map(function(item) {
      return item.file;
    });
  });
};

var addAllRepoFiles = function (files) {
  console.log('GIT: Adding Unstaged Files');
  return Repo.addAsync(files);
};

var commitNextVersion = function () {
  console.log('GIT: Commit "Release v' + this.NEXT_VERSION + '"');
  return Repo.commitAsync('Release v' + this.NEXT_VERSION);
};

var tagNextVersion = function () {
  console.log('GIT: Tag "v' + this.NEXT_VERSION + '"');
  return Repo.tagAsync('v' + this.NEXT_VERSION);
};

var checkIfReadyToPush = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you ready to push v' + self.NEXT_VERSION + ' to origin?',
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
    Repo.push('origin', 'master', [], function (err) {
      if (err) return reject( err );
      resolve();
    }, credentials);
  });
};

var publishToNPM = function () {
  return new Promise(function (resolve, reject) {
    shell.exec('npm publish', function (code, output) {
      if (code !== 0) return reject('npm publish exited with ' + code);
      resolve();
    });
  });
};

module.exports = function () {
  return Promise.bind({})
    .then( checkStatusOfRepo )
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
    .then( pushBranchToOrigin )
    .then( publishToNPM );
};
