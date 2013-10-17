// Generated by CoffeeScript 1.6.3
var File, findFile, fs;

File = require('../models/file');

fs = require('fs');

findFile = function(id, callback) {
  var _this = this;
  return File.find(id, function(err, file) {
    if (err || !file) {
      return callback("File not found");
    } else {
      return callback(null, file);
    }
  });
};

module.exports.all = function(req, res) {
  return File.all(function(err, files) {
    if (err) {
      return res.send({
        error: true,
        msg: "Server error occured"
      }, 500);
    } else {
      return res.send(files);
    }
  });
};

module.exports.create = function(req, res) {
  var file,
    _this = this;
  file = req.files["file"];
  return File.create(req.body, function(err, newfile) {
    if (err) {
      return res.send({
        error: true,
        msg: "Server error while creating file."
      }, 500);
    } else {
      return newfile.attachFile(file.path, {
        "name": "thumb"
      }, function(err) {
        if (err) {
          console.log("[Error]: " + err);
        }
        return fs.unlink(file.path, function(err) {
          if (err) {
            console.log('Could not delete', file.path);
          }
          return res.send(newfile, 200);
        });
      });
    }
  });
};

module.exports.find = function(req, res) {
  return findFile(req.params.id, function(err, file) {
    if (err) {
      return res.send({
        error: true,
        msg: err
      }, 404);
    } else {
      return res.send(file);
    }
  });
};

module.exports.getAttachment = function(req, res) {
  var id,
    _this = this;
  id = req.params.id;
  return findFile(id, function(err, file) {
    var stream;
    if (err) {
      return res.send({
        error: true,
        msg: err
      }, 404);
    } else {
      res.setHeader('Content-Disposition', "inline");
      res.setHeader('content-type', "mime/type");
      stream = file.getFile("thumb", function(err, resp, body) {
        if (err) {
          return res.send({
            error: true,
            msg: err
          }, 500);
        }
      });
      res.setHeader('content-type', "mime/type");
      stream.setHeader('content-type', "mime/type");
      return stream.pipe(res);
    }
  });
};

module.exports.destroy = function(req, res) {
  return findFile(req.params.id, function(err, file) {
    if (err) {
      return res.send({
        error: true,
        msg: err
      }, 404);
    } else {
      return file.destroy(function(err) {
        if (err) {
          compound.logger.write(err);
          return res.send({
            error: 'Cannot destroy file'
          }, 500);
        } else {
          return res.send({
            success: 'File succesfuly deleted'
          }, 200);
        }
      });
    }
  });
};
