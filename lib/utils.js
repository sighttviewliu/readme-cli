var path = require('path')

module.exports.absPath = function(p) {
  if(p.substr(0, 1) != '/' && p.substr(0, 1) != '~') {
    p = path.resolve(process.cwd(), p);
  }
  if(p.substr(0, 1) == '~') {
    var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
    p = path.resolve(home, p.replace('~/', ''));
  }
  return p;
};

module.exports.cleanVersion = function(version) {
  if(!version) return version;

  var v = version.trim().match(/^[v=]?([0-9]*)(?:\.([0-9]+))?(?:\.([0-9]+))?(-.*)?$/)
  if(!v) return null;

  version  = (v[1] ? v[1].replace(/0*([0-9]+)/, '$1') : 0) + "."
  version += (v[2] ? v[2].replace(/0*([0-9]+)/, '$1') : 0) + "."
  version += (v[3] ? v[3].replace(/0*([0-9]+)/, '$1') : 0)

  version += v[4] ? v[4] : ""
  return version;
};

module.exports.url = function(path) {
  return "https://readme.io/cli/" + path;
};

