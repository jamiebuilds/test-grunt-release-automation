var async = require('async');
var fs = require('fs');
var inquirer = require('inquirer');
var _ = require('underscore');

function Release (options) {
  this.done = options.done;
  this.queueTask = options.queueTask;

  async.series([
    _.bind(this.getTypeOfRelease, this),
    _.bind(this.getPrevVersion, this),
    _.bind(this.getNextVersion, this),
    _.bind(this.confirmNextVersion, this),
    _.bind(this.prepareChangelog, this),
    _.bind(this.editChangelog, this),
    _.bind(this.editUpgradeGuide, this),
    _.bind(this.confirmReadyToRelease, this),
    _.bind(this.queueReleaseTask, this)
  ], this.done);
}

_.extend(Release.prototype, {

  getTypeOfRelease: function (next) {
    var self = this;
    inquirer.prompt([{
      type : 'list',
      name : 'type',
      message : 'What kind of release is this?',
      choices : ['patch', 'minor', 'major']
    }], function (answers) {
      self.releaseType = answers.type;
      next();
    });
  },

  getPrevVersion: function (next) {
    this.prevVersion = require('../package.json').version;
    next();
  },

  getNextVersion: function (next) {
    var version = this.prevVersion.split('.').map(function (num) {
      return parseInt(num, 10);
    });

    if (this.releaseType === 'patch') { version[2] += 1; }
    if (this.releaseType === 'minor') { version[1] += 1; version[2] = 0; }
    if (this.releaseType === 'major') { version[0] += 1; version[1] = 0; version[2] = 0; }

    this.nextVersion = version.join('.');
    next();
  },

  confirmNextVersion: function (next) {
    var self = this;

    inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Is version ' + self.nextVersion + ' correct?',
    }], function (answers) {
      if (answers.confirm) {
        next();
      } else {
        self.done();
      }
    });
  },

  prepareChangelog: function (next) {
    var self = this;

    fs.readFile('./CHANGELOG.md', function (err, data) {
      data = data.toString().split('\n\n');
      data.splice(1, 0, '### ' + self.nextVersion + '\n');
      data = data.join('\n\n');

      fs.writeFile('./CHANGELOG.md', data, next);
    });
  },

  editChangelog: function (next) {
    var editor = require('child_process').spawn('vim', ['+4', 'CHANGELOG.md'], { stdio: 'inherit' });
    editor.on('exit', next);
  },

  editUpgradeGuide: function (next) {
    var editor = require('child_process').spawn('vim', ['+3', 'UPGRADE-GUIDE.md'], { stdio: 'inherit' });
    editor.on('exit', next);
  },

  confirmReadyToRelease: function (next) {
    var self = this;

    inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you ready to release ' + self.nextVersion + '?',
    }], function (answers) {
      if (answers.confirm) {
        next();
      } else {
        self.done();
      }
    });
  },

  queueReleaseTask: function (next) {
    this.queueTask('bump:' + this.releaseType);
    next();
  }
});

module.exports = Release;
