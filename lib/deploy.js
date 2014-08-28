var exec = require('child_process').exec
  , fs = require('fs')
  , async = require('async')
  , path = require('path')

  , colors = require('colors')
  , prompt = require('readline-sync')
  , request = require('request')
  , semver = require('semver')
  , _ = require('lodash')

  , utils = require('./utils')

module.exports.exec = function(program) {
  var opts = {
    dir: '',
    version: false,
    config_path: '',
    verbose: program.verbose,
    config: {},
    auth: {},
    raw: {},
    apiVersion: program.version(),
    docs_url: false,
  };

  async.series([

    /* Figure out version */
    function(next) {
      // TODO: ask for version if they didn't provide it

      var versionClean = utils.cleanVersion(program.args[1]);

      if(!semver.valid(versionClean)) {
        return next({
          error: true, 
          message: 'This is not a valid semver version.', 
          alt: 'See semver documentation for more details.'
        });
      }

      opts.version = semver.clean(versionClean);
      console.log("Uploading version ".grey + opts.version);
      next();
    },

    /* Load the user's token if possible */
    function(next) {
      opts.auth_url = utils.absPath('~/.readmeio.json');
      if(fs.existsSync(opts.auth_url)) {

        // Auth file exists
        fs.readFile(opts.auth_url, 'utf8', function (err, auth) {
          opts.auth = JSON.parse(auth);
          next();
        });

      } else {

        next();

      }
    },

    /* Is the user logged in? */

    function(next) {
      if(!_.isEmpty(opts.auth)) {
        return next();
      }

      console.log('Log in to ReadMe'.bold);
      console.log('Not sure of your token? https://readme.io/whats-my-token'.grey);
      opts.auth = {};
      opts.auth.token = prompt.question('Auth token: ');
      if(!opts.auth.token) {
        return next({error: true, message: 'You need an auth token to continue.'});
      }

      fs.writeFile(opts.auth_url, JSON.stringify(opts.auth, undefined, 2), function (err, _config) {
        console.log('');
        console.log('Wrote auth file to '.grey + '~/.readmeio.json' + '.'.grey);
        console.log('');
        next();
      });
    },

    /* Set up request */
    function(next) {
      request = request.defaults({
        headers: {
          'auth-token': opts.auth.token,
        },
        'json': true,
      });
      next();
    },

    /* Get the working directory from git */
    function(next) {
      opts.dir = process.cwd();
      exec('git rev-parse --show-toplevel', function(err, stdout, stderr) {
        if(stdout) {
          opts.dir = stdout.trim();
        }
        next();
      });
    },

    /* Load the project's config file */
    function(next) {
      opts.config_path = path.join(opts.dir, 'readmeio.json');
      if(fs.existsSync(opts.config_path)) {

        // Config file exists
        fs.readFile(opts.config_path, 'utf8', function (err, _config) {
          if (!err) {
            opts.config = JSON.parse(_config);
          }
          next(err);
        });

      } else {

        // We need to create it
        next();

      }
    },

    /* No config file? Set it up. */
    function(next) {

      // Already have it?
      if(!_.isEmpty(opts.config)) return next();

      request.get(utils.url('projects'), function(err, r, projects) {
        if(err) return next(err);

        console.log('');
        console.log('Your projects:');
        _.each(projects, function(p, i) {
          console.log((' [' + i + '] ').grey + p[1] + (" (" + p[0] + ")").grey);
        });
        var project = prompt.question("Which project are you setting up? #");

        opts.config = {};
        opts.config.project = projects[parseInt(project)][0];
        console.log("Set up ",projects[parseInt(project)][0]);

        var types = [
          "rspec_api_documentation",
        ];

        console.log("");
        console.log("Current documentation:");
        _.each(types, function(v, i) {
          console.log((" [" + (i+1) + "] ").grey + v);
        });
        console.log(" [0]".grey + " Other");
        var type = prompt.question("How is your API or code currently documented? #");

        if(type <= 0) {
          console.log('');
          console.log('*********************************');
          console.log('');
          console.log('Oh no!'.red);
          console.log('Looks like you\'re using something we don\'t yet support. Let\'s fix that!');
          console.log('');
          console.log('  Email us: newfeature@readme.io'.grey );
          console.log('  Pull request: http://github.com/readmeio/readme-cli'.grey );
          console.log('');
          console.log('*********************************');
          return next({error: true, quit: true});
        }

        opts.config.type = types[type-1];
        opts.config.setup = false;
        fs.writeFile(opts.config_path, JSON.stringify(opts.config, undefined, 2), function(err) {
          if(err) return next(err);

          console.log('');
          console.log('Wrote config file to '.grey + './readmeio.json' + '. You may either commit it or .gitignore it. Delete it to go through the setup again.'.grey);
          next();
        });

      })

    },

    /* Set up the documentation exporter */
    function(next) {

      if(opts.config.setup) return next();

      var recipe = require('../recipes/' + opts.config.type);
      recipe.setup(opts, function(err, setup) {

        if(err) return next(err);

        opts.config.setup = setup;

        console.log('');
        console.log('Setup complete!'.green);
        console.log('');
        fs.writeFile(opts.config_path, JSON.stringify(opts.config, undefined, 2), next);

      });

    },

    /* Run the recipe */
    function(next) {
      var recipe = require('../recipes/' + opts.config.type);
      recipe.output(opts, function(err, raw) {
        if(err) {
          return next(err);
        }

        opts.raw = raw;
        next();
      });
    },

    /* Upload it to ReadMe.io */
    function(next) {

      request.post({ url: utils.url('docs/' + opts.config.project + '/v' + opts.version), json: opts}, function(err, response, body) {
        if(body && body.error) {
          return next({message: 'We were unable to automatically parse your docs', alt: "Don't worry, though! Your generated docs were saved, and we're going to look into it ASAP."});
        }

        if(response.statusCode > 299) {
          return next({message: 'There was an error:', alt: '  ' + JSON.stringify(body)});
        }

        if(body && body.url) {
          opts.docs_url = body.url;
        }
        next();
      });
    },

  ], function(err) {

    if(err && !err.quit) {
      console.log('');
      console.log('***********************');
      console.log('');
      console.log('ERROR!'.red);
      console.log(err.message);
      if(err.alt) {
        console.log(err.alt.grey);
      }
      console.log('');
      console.log('***********************');
      console.log('');
      return;
    }

    console.log('');
    console.log('***********************');
    console.log('');
    console.log('Success!'.green);
    console.log('Your docs were built!');
    if(opts.docs_url) {
      console.log('You can see the changes here:');
      console.log('  ' + opts.docs_url.grey);
    }
    console.log('');
    console.log('***********************');
    console.log('');
  })
};
