var Promise = require('bluebird');
var promptAsync = require('./prompt');
var Repo = Promise.promisifyAll(require('gitty')('./'));
var shell = require('shelljs');

module.exports = {
  checkIfReadyToPush: function () {
    return promptAsync([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you ready to push v' + this.NEXT_VERSION + ' to origin?',
    }]).then(function (answers) {
      if (!answers.confirm) throw new Error('Cancelled.');
    });
  },

  pushBranchToOrigin: function (credentials) {
    return Repo.pushAsync('origin', 'master', []);
  },

  publishToNPM: function () {
    return new Promise(function (resolve, reject) {
      shell.exec('npm publish', function (code, output) {
        if (code !== 0) return reject('npm publish exited with ' + code);
        resolve();
      });
    });
  }
};
