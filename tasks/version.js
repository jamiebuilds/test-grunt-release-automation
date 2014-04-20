var Promise = require('bluebird');
var promptAsync = require('./prompt');
var semver = require('semver');
var path = require('path');
var Repo = Promise.promisifyAll(require('gitty')('./'));
var editorAsync = Promise.promisify(require('editor'));

module.exports = {
  checkStatusOfRepo: function() {
    return Repo.statusAsync().then(function(status) {
      if (status.staged.length > 0 || status.not_staged.length > 0) {
        throw new Error('Please commit all files before performing a release.');
      }
    });
  },

  getTypeOfRelease: function() {
    return promptAsync([{
      type : 'list',
      name : 'type',
      message : 'What kind of release is this?',
      choices : ['patch', 'minor', 'major']
    }]).get('type');
  },

  getVersion: function(type) {
    var currentVersion = require(path.join('../', 'package.json')).version;

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
  },

  checkForBadVersion: function() {
    return Repo.tagsAsync().then(function(tags) {
      if (tags.indexOf('v' + this.NEXT_VERSION) > -1) {
        throw new Error('Tag v' + this.NEXT_VERSION + ' already exists.');
      }
    });
  },

  editChangelog: function() {
    console.log('VIM: Edited CHANGELOG');
    return editorAsync('CHANGELOG.md');
  },

  editUpgradeGuide: function() {
    console.log('VIM: Edited Upgrade Guide');
    return editorAsync('UPGRADE-GUIDE.md');
  }
};
