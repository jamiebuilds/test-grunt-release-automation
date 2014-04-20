var release = require('./tasks/release');

module.exports = function (grunt) {
  grunt.task.registerTask('release', function () {
    var done = this.async();
    release().then(function () {
      grunt.log.ok('Great Success');
      done();
    })
    .catch(function (err) {
      grunt.log.error(err);
      done();
    });
  });
};
