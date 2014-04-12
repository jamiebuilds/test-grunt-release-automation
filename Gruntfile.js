module.exports = function (grunt) {

  grunt.loadNpmTasks('grunt-bump');

  grunt.initConfig({
    bump: {
      options: {
        files: ['package.json', 'bower.json'],
        updateConfigs: [],
        commit: true,
        commitMessage: 'Release v%VERSION%',
        commitFiles: ['-a'], // '-a' for all files
        createTag: true,
        tagName: 'v%VERSION%',
        tagMessage: 'Version %VERSION%',
        push: true,
        pushTo: 'origin',
        gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d' // options to use with '$ git describe'
      }
    }
  });

  grunt.task.registerTask('release', function () {
    var done = this.async();
    var Release = require('./tasks/release');
    var release = new Release({
      done: done,
      queueTask: function (task) {
        grunt.task.run(task);
      }
    });
  });

  grunt.task.registerTask('npm-publish', function () {
    var done = this.async();
    var npm = require('child_process').spawn('npm', ['publish'], { stdio: 'inherit' });
    npm.on('exit', done);
  });

};
