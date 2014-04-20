var Promise = require('bluebird');
var semver = require('semver');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var inquirer = require('inquirer');
var shell = require('shelljs');
var Repo = Promise.promisifyAll(require('gitty')('./'));
var execAsyncProcess = Promise.promisify(require('child_process').exec);

var promptAsync = function(questions) {
  return new Promise(function(resolve, reject) {
    inquirer.prompt(questions, function (answers) {
      resolve(answers);
    });
  });
};

var checkStatusOfRepo = function() {
  return Repo.statusAsync().then(function(status) {
    if (status.staged.length > 0 || status.not_staged.length > 0) {
      throw new Error('Please commit all files before performing a release.');
    }
  });
};

var getTypeOfRelease = function() {
  return promptAsync([{
    type : 'list',
    name : 'type',
    message : 'What kind of release is this?',
    choices : ['patch', 'minor', 'major']
  }]).get('type');
};

var getVersion = function(type) {
  var self = this;
  var currentVersion = require('../package.json').version;

  if (!semver.valid( currentVersion )) {
    throw new Error('Current version (' + currentVersion + ') is invalid.', currentVersion);
  }

  this.NEXT_VERSION = semver.inc(currentVersion, type);

  if (!semver.valid( this.NEXT_VERSION )) {
    throw new Error('Current version (' + this.NEXT_VERSION + ') is invalid.');
  }

  return promptAsync([{
    type: 'confirm',
    name: 'confirm',
    message: 'Is version ' + this.NEXT_VERSION + ' okay?',
  }]).then(function(answers) {
    if (!answers.confirm) throw new Error('Cancelled.');
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
  console.log('VIM: Edited CHANGELOG');
  return execAsyncProcess('subl -w CHANGELOG.md');
};

var editUpgradeGuide = function() {
  console.log('VIM: Edited Upgrade Guide');
  return execAsyncProcess('vim', ['UPGRADE-GUIDE.md'], { stdio: 'inherit' });
};

var confirmReadyToPublish = function() {
  promptAsync([{
    type: 'confirm',
    name: 'confirm',
    message: 'Are you ready to publish ' + this.NEXT_VERSION + '?',
  }]).then(function (answers) {
    if (!answers.confirm) throw new Error('Cancelled.');
  });
};

var updateJsonFileVersion = function(file, version) {
  var data = require(file);
  var filepath = path.resolve(__dirname, file);

  data.version = version;
  data = JSON.stringify(data, null, 2);
  data += '\n';

  return fs.writeFileAsync(filepath, data);
};

var updatePackageJson = function() {
  return updateJsonFileVersion('../package.json', this.NEXT_VERSION);
};

var updateBowerJson = function() {
  return updateJsonFileVersion('../bower.json', this.NEXT_VERSION);
};

var getUnstagedFiles = function() {
  return Repo.statusAsync()
    .get('not_staged')
    .map(function (item) {
      return item.file;
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
  return promptAsync([{
    type: 'confirm',
    name: 'confirm',
    message: 'Are you ready to push v' + this.NEXT_VERSION + ' to origin?',
  }]).then(function (answers) {
    if (!answers.confirm) throw new Error('Cancelled.');
  });
};

var pushBranchToOrigin = function (credentials) {
  return Repo.pushAsync('origin', 'master', []);
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
    .then( pushBranchToOrigin )
    .then( publishToNPM );
};
