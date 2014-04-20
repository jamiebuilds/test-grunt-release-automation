var Promise = require('bluebird');

var version = require('./version');
var publish = require('./publish');
var push = require('./push');

module.exports = function () {
  return Promise.bind({})
    .then( version.checkStatusOfRepo )
    .then( version.getTypeOfRelease )
    .then( version.getVersion )
    .then( version.checkForBadVersion )
    .then( version.editChangelog )
    .then( version.editUpgradeGuide )
    .then( publish.confirmReadyToPublish )
    .then( publish.updatePackageJson )
    .then( publish.updateBowerJson )
    .then( publish.getUnstagedFiles )
    .then( publish.addAllRepoFiles )
    .then( publish.commitNextVersion )
    .then( publish.tagNextVersion )
    .then( push.checkIfReadyToPush )
    .then( push.pushBranchToOrigin )
    .then( push.publishToNPM );
};
