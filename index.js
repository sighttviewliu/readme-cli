var program = require('commander')
  , deploy = require('./lib/deploy')

function convert() {
  program
  .version('0.0.1')
  .usage('readmeio deploy [version]')
  .option('-v, --verbose', 'Verbose output')
  .parse(process.argv);

  if(program.args[0] == 'deploy') {
    deploy.exec(program);
  } else {
    program.help();
  }
};

exports.convert = convert;

/* TODO:
 * [ ] Better checking of options?
 */

