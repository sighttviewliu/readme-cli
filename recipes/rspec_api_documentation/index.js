#!/usr/bin/env node
var prompt = require('readline-sync')
  , exec = require('child_process').exec
  , path = require('path')
  , fs = require('fs')
  , _ = require('lodash')

module.exports.setup = function(opts, next) {

  console.log('');
  console.log('------------------------------');
  console.log('');
  console.log('RSpec API Documentation Setup'.bold);
  console.log("");
  console.log('Where are your docs outputted to? ' + '(Default is doc/api; check RspecApiDocumentation.config.docs_dir)'.grey)
  var output_dir = prompt.question((opts.dir + '/').grey);
  console.log('');
  console.log('');
  console.log('Now, update your RspecApiDocumentation config to include :combined_json');
  console.log('');
  console.log('  config.format = [{..your formats..}, '.grey + ':combined_json'.green + ']'.grey);
  console.log('');
  var format = prompt.question('Did you make the above changes to your config? (y/n) ');

  if(format[0] !== 'y') return next({'error': true, 'message': 'You must update your RspecApiDocumentation configuration'});

  var output = {'output_dir': output_dir};

  exec("git log --pretty=format:%H | tail -1", function(err, stdout, stderr) {
    output.unique = stdout;
    next(null, output);
  });
};

module.exports.output = function(opts, next) {

  // Run the docs generation command
  console.log("Generating documentation...");
  exec("rake docs:generate", {cwd: opts.dir}, function() {

    // Make sure the folder exists
    var output_dir = path.join(opts.dir, opts.config.setup.output_dir)
    if(!fs.existsSync(output_dir)) {
      return next({
        'error': true, 
        'message': 'It looks like your output directory is wrong.',
        'alt': 'Update setup.output_dir in your readmeio.json file.',
      });
    }

    // Make sure the file exists
    var output_file = path.join(output_dir, 'combined.json')
    if(!fs.existsSync(output_file)) {
      return next({
        'error': true, 
        'message': 'It looks like your output format is wrong.',
        'alt': 'Make sure you add :combined_json to your RspecApiDocumentation\'s config.format.',
      });
    }

    // Get the file!
    fs.readFile(output_file, 'utf8', function (err, output) {
      next(null, output);
    });

  })

};
