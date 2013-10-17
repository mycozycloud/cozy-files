// Generated by CoffeeScript 1.6.3
var Remote, findRemote, randomString;

Remote = require('../models/remote');

randomString = function(length) {
  var string;
  string = "";
  while (string.length < length) {
    string = string + Math.random().toString(36).substr(2);
  }
  return string.substr(0, length);
};

findRemote = function(id, callback) {
  var _this = this;
  return Remote.find(id, function(err, remote) {
    if (err || !remote) {
      return callback("Remote not found");
    } else {
      return callback(null, remote);
    }
  });
};

module.exports.create = function(req, res) {
  var remote;
  remote = {
    password: randomString(32)
  };
  if (req.body.login != null) {
    remote.login = req.body.login;
  } else {
    remote.login = randomString(8);
  }
  return Remote.all(function(err, remotes) {
    var conflict, rem, _i, _len;
    conflict = false;
    for (_i = 0, _len = remotes.length; _i < _len; _i++) {
      rem = remotes[_i];
      if (rem.login === remote.login) {
        conflict = true;
        res.send({
          error: true,
          msg: "This folder already exists"
        }, 400);
      }
    }
    if (!conflict) {
      return Remote.create(remote, function(err, newRemote) {
        if (err) {
          return res.send({
            error: true,
            msg: "Server error while creating file."
          }, 500);
        } else {
          return res.send(newRemote, 200);
        }
      });
    }
  });
};

module.exports.update = function(req, res) {
  return findRemote(req.params.id, function(err, remote) {
    if (err) {
      return res.send({
        error: true,
        msg: err
      }, 404);
    } else {
      req.body.password = remote.password;
      return remote.updateAttributes(req.body, function(err, newRemote) {
        if (err) {
          return res.send({
            error: true,
            msg: "Server error while creating file."
          }, 500);
        } else {
          return res.send(newRemote, 200);
        }
      });
    }
  });
};

module.exports.updateToken = function(req, res) {
  return findRemote(req.params.id, function(err, remote) {
    if (err) {
      return res.send({
        error: true,
        msg: err
      }, 404);
    } else {
      remote.password = randomString(32);
      return remote.updateAttributes(remote, function(err, newRemote) {
        if (err) {
          return res.send({
            error: true,
            msg: "Server error while creating file."
          }, 500);
        } else {
          return res.send(newRemote, 200);
        }
      });
    }
  });
};

module.exports.destroy = function(req, res) {
  return findRemote(req.params.id, function(err, remote) {
    if (err) {
      return res.send({
        error: true,
        msg: err
      }, 404);
    } else {
      return remote.destroy(function(err) {
        if (err) {
          compound.logger.write(err);
          return res.send({
            error: 'Cannot destroy file'
          }, 500);
        } else {
          return res.send({
            success: 'Remote succesfuly deleted'
          }, 200);
        }
      });
    }
  });
};
