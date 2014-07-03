// Generated by CoffeeScript 1.7.1
var CozyInstance, File, Folder, KB, MB, archiver, async, findFolder, folderParent, getFolderPath, jade, log, moment, normalizePath, pathHelpers, publicfoldertemplate, resetTimeout, sharing, template, timeout, updateParents;

jade = require('jade');

async = require('async');

archiver = require('archiver');

moment = require('moment');

log = require('printit')({
  prefix: 'folders'
});

sharing = require('../helpers/sharing');

pathHelpers = require('../helpers/path');

Folder = require('../models/folder');

File = require('../models/file');

CozyInstance = require('../models/cozy_instance');

publicfoldertemplate = require('path').join(__dirname, '../views/publicfolder.jade');

template = require('path').join(__dirname, '../views/index.jade');

KB = 1024;

MB = KB * KB;

module.exports.fetch = function(req, res, next, id) {
  return Folder.request('all', {
    key: id
  }, function(err, folder) {
    if (err || !folder || folder.length === 0) {
      if (err == null) {
        err = new Error('File not found');
        err.status = 404;
        err.template = {
          name: '404',
          params: {
            localization: require('../lib/localization_manager'),
            isPublic: req.url.indexOf('public') !== -1
          }
        };
      }
      return next(err);
    } else {
      req.folder = folder[0];
      return next();
    }
  });
};

findFolder = function(id, callback) {
  return Folder.find(id, (function(_this) {
    return function(err, folder) {
      if (err || !folder) {
        return callback("Folder not found");
      } else {
        return callback(null, folder);
      }
    };
  })(this));
};

getFolderPath = function(id, cb) {
  if (id === 'root') {
    return cb(null, "");
  } else {
    return findFolder(id, function(err, folder) {
      if (err) {
        return cb(err);
      } else {
        return cb(null, folder.path + '/' + folder.name, folder);
      }
    });
  }
};

normalizePath = function(path) {
  if (path[0] !== '/') {
    path = "/" + path;
  }
  if (path === "/") {
    path = "";
  }
  return path;
};

folderParent = {};

timeout = null;

module.exports.create = function(req, res, next) {
  var folder;
  if (timeout != null) {
    clearTimeout(timeout);
  }
  folder = req.body;
  folder.path = normalizePath(folder.path);
  if ((!folder.name) || (folder.name === "")) {
    return next(new Error("Invalid arguments"));
  } else {
    return Folder.all((function(_this) {
      return function(err, folders) {
        var available, createFolder, fullPath, now, parent, parents;
        available = pathHelpers.checkIfPathAvailable(folder, folders);
        if (!available) {
          return res.send({
            error: true,
            msg: "This folder already exists"
          }, 400);
        } else {
          fullPath = folder.path;
          parents = folders.filter(function(tested) {
            return fullPath === tested.getFullPath();
          });
          now = moment().toISOString();
          createFolder = function() {
            folder.creationDate = now;
            folder.lastModification = now;
            return Folder.createNewFolder(folder, function(err, newFolder) {
              var who;
              resetTimeout();
              if (err) {
                return next(err);
              }
              who = req.guestEmail || 'owner';
              return sharing.notifyChanges(who, newFolder, function(err) {
                if (err) {
                  console.log(err);
                }
                return res.send(newFolder, 200);
              });
            });
          };
          if (parents.length > 0) {
            parent = parents[0];
            folder.tags = parent.tags;
            parent.lastModification = now;
            folderParent[parent.name] = parent;
            return createFolder();
          } else {
            folder.tags = [];
            return createFolder();
          }
        }
      };
    })(this));
  }
};

resetTimeout = (function(_this) {
  return function() {
    if (timeout != null) {
      clearTimeout(timeout);
    }
    return timeout = setTimeout(function() {
      return updateParents();
    }, 60 * 1000);
  };
})(this);

updateParents = function() {
  var errors, folder, name, _i, _len, _ref;
  errors = {};
  _ref = Object.keys(folderParent);
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    name = _ref[_i];
    folder = folderParent[name];
    folder.save(function(err) {
      if (err != null) {
        return errors[folder.name] = err;
      }
    });
  }
  return folderParent = {};
};

module.exports.find = function(req, res, next) {
  return res.send(req.folder);
};

module.exports.tree = function(req, res, next) {
  var folderChild;
  folderChild = req.folder;
  return folderChild.getParents((function(_this) {
    return function(err, folders) {
      if (err) {
        return next(err);
      } else {
        return res.send(folders, 200);
      }
    };
  })(this));
};

module.exports.list = function(req, res, next) {
  return Folder.allPath(function(err, paths) {
    if (err) {
      return next(err);
    } else {
      return res.send(paths);
    }
  });
};

module.exports.modify = function(req, res, next) {
  var body, folder, isPublic, newName, newPath, newRealPath, newTags, oldRealPath, previousName, previousPath, updateFoldersAndFiles, updateIfIsSubFolder, updateTheFolder;
  body = req.body;
  if (body.path != null) {
    body.path = normalizePath(body.path);
  }
  folder = req.folder;
  if ((req.body.name == null) && (req.body["public"] == null) && (req.body.tags == null) && (req.body.path == null)) {
    return res.send({
      error: true,
      msg: "Data required"
    }, 400);
  }
  previousName = folder.name;
  newName = body.name != null ? body.name : previousName;
  previousPath = folder.path;
  newPath = body.path != null ? body.path : previousPath;
  oldRealPath = "" + previousPath + "/" + previousName;
  newRealPath = "" + newPath + "/" + newName;
  newTags = req.body.tags || [];
  newTags = newTags.filter(function(tag) {
    return typeof tag === 'string';
  });
  isPublic = req.body["public"];
  updateIfIsSubFolder = function(file, cb) {
    var data, modifiedPath, oldTags, tag, tags, _i, _len;
    if (file.path.indexOf(oldRealPath) === 0) {
      modifiedPath = file.path.replace(oldRealPath, newRealPath);
      oldTags = file.tags;
      tags = [].concat(oldTags);
      for (_i = 0, _len = newTags.length; _i < _len; _i++) {
        tag = newTags[_i];
        if (tags.indexOf(tag === -1)) {
          tags.push(tag);
        }
      }
      data = {
        path: modifiedPath,
        tags: tags
      };
      return file.updateAttributes(data, cb);
    } else {
      return cb(null);
    }
  };
  updateTheFolder = function() {
    var data;
    data = {
      name: newName,
      path: newPath,
      "public": isPublic,
      tags: newTags,
      lastModification: moment().toISOString()
    };
    if (req.body.clearance) {
      data.clearance = req.body.clearance;
    }
    return folder.updateParentModifDate(function(err) {
      if (err) {
        log.raw(err);
      }
      return folder.updateAttributes(data, (function(_this) {
        return function(err) {
          if (err) {
            return next(err);
          }
          return folder.updateParentModifDate(function(err) {
            if (err) {
              log.raw(err);
            }
            return folder.index(["name"], function(err) {
              if (err) {
                log.raw(err);
              }
              return res.send({
                success: 'File succesfuly modified'
              }, 200);
            });
          });
        };
      })(this));
    });
  };
  updateFoldersAndFiles = function(folders) {
    return async.each(folders, updateIfIsSubFolder, function(err) {
      if (err) {
        return next(err);
      } else {
        return File.all((function(_this) {
          return function(err, files) {
            if (err) {
              return next(err);
            } else {
              return async.each(files, updateIfIsSubFolder, function(err) {
                if (err) {
                  return next(err);
                } else {
                  return updateTheFolder();
                }
              });
            }
          };
        })(this));
      }
    });
  };
  return Folder.byFullPath({
    key: newRealPath
  }, function(err, sameFolders) {
    if (err) {
      return next(err);
    }
    if (sameFolders.length > 0 && sameFolders[0].id !== req.body.id) {
      return res.send({
        error: true,
        msg: "The name already in use"
      }, 400);
    } else {
      return Folder.all(function(err, folders) {
        if (err) {
          return next(err);
        }
        return updateFoldersAndFiles(folders);
      });
    }
  });
};

module.exports.destroy = function(req, res, next) {
  var currentFolder, destroyIfIsSubdirectory, destroySubFiles, destroySubFolders, directory;
  currentFolder = req.folder;
  directory = "" + currentFolder.path + "/" + currentFolder.name;
  destroyIfIsSubdirectory = function(file, cb) {
    var pathToTest;
    pathToTest = "" + file.path + "/";
    if (pathToTest.indexOf("" + directory + "/") === 0) {
      return file.destroy(cb);
    } else {
      return cb(null);
    }
  };
  destroySubFolders = function(callback) {
    return Folder.all(function(err, folders) {
      if (err) {
        return next(err);
      } else {
        return async.each(folders, destroyIfIsSubdirectory, function(err) {
          if (err) {
            return next(err);
          } else {
            return callback();
          }
        });
      }
    });
  };
  destroySubFiles = function(callback) {
    return File.all((function(_this) {
      return function(err, files) {
        if (err) {
          return next(err);
        } else {
          return async.each(files, destroyIfIsSubdirectory, function(err) {
            if (err) {
              return next(err);
            } else {
              return callback();
            }
          });
        }
      };
    })(this));
  };
  return destroySubFolders(function() {
    return destroySubFiles(function() {
      return currentFolder.destroy(function(err) {
        if (err) {
          return next(err);
        } else {
          return currentFolder.updateParentModifDate(function(err) {
            if (err) {
              log.raw(err);
            }
            return res.send({
              success: "Folder succesfuly deleted: " + directory
            });
          });
        }
      });
    });
  });
};

module.exports.findFiles = function(req, res, next) {
  return getFolderPath(req.body.id, function(err, key) {
    if (err) {
      return next(err);
    } else {
      return File.byFolder({
        key: key
      }, function(err, files) {
        if (err) {
          return next(err);
        } else {
          return res.send(files, 200);
        }
      });
    }
  });
};

module.exports.allFolders = function(req, res, next) {
  return Folder.all(function(err, folders) {
    if (err) {
      return next(err);
    } else {
      return res.send(folders);
    }
  });
};

module.exports.findContent = function(req, res, next) {
  return getFolderPath(req.body.id, function(err, key, folder) {
    if (err != null) {
      return next(err);
    } else {
      return async.parallel([
        function(cb) {
          return Folder.byFolder({
            key: key
          }, cb);
        }, function(cb) {
          return File.byFolder({
            key: key
          }, cb);
        }, function(cb) {
          if (req.body.id === "root") {
            return cb(null, []);
          } else {
            if (req.url.indexOf('/public/') !== -1) {
              return sharing.limitedTree(folder, req, function(parents, authorized) {
                return cb(null, parents);
              });
            } else {
              return folder.getParents(cb);
            }
          }
        }
      ], function(err, results) {
        var content, files, folders, parents;
        if (err != null) {
          return next(err);
        } else {
          folders = results[0], files = results[1], parents = results[2];
          content = folders.concat(files);
          return res.send(200, {
            content: content,
            parents: parents
          });
        }
      });
    }
  });
};

module.exports.findFolders = function(req, res, next) {
  return getFolderPath(req.body.id, function(err, key) {
    if (err) {
      return next(err);
    } else {
      return Folder.byFolder({
        key: key
      }, function(err, files) {
        if (err) {
          return next(err);
        } else {
          return res.send(files, 200);
        }
      });
    }
  });
};

module.exports.search = function(req, res, next) {
  var parts, query, sendResults, tag;
  sendResults = function(err, files) {
    if (err) {
      return next(err);
    } else {
      return res.send(files);
    }
  };
  query = req.body.id;
  query = query.trim();
  if (query.indexOf('tag:') !== -1) {
    parts = query.split();
    parts = parts.filter(function(part) {
      return part.indexOf('tag:' !== -1);
    });
    tag = parts[0].split('tag:')[1];
    return Folder.request('byTag', {
      key: tag
    }, sendResults);
  } else {
    return Folder.search("*" + query + "*", sendResults);
  }
};

module.exports.searchContent = function(req, res, next) {
  var err, isPublic, key, parts, query, requests, tag;
  query = req.body.id;
  query = query.trim();
  isPublic = req.url.indexOf('/public/') === 0;
  key = req.query.key;
  if (isPublic && !(key != null ? key.length : void 0) > 0) {
    err = new Error('You cannot access public search result');
    err.status = 401;
    return next(err);
  } else {
    if (query.indexOf('tag:') !== -1) {
      parts = query.split();
      parts = parts.filter(function(part) {
        return part.indexOf('tag:' !== -1);
      });
      tag = parts[0].split('tag:')[1];
      requests = [
        function(cb) {
          return Folder.request('byTag', {
            key: tag
          }, cb);
        }, function(cb) {
          return File.request('byTag', {
            key: tag
          }, cb);
        }
      ];
    } else {
      requests = [
        function(cb) {
          return Folder.search("*" + query + "*", cb);
        }, function(cb) {
          return File.search("*" + query + "*", cb);
        }
      ];
    }
    return async.parallel(requests, function(err, results) {
      var content, files, folders, isAuthorized, sendResults;
      if (err != null) {
        return next(err);
      } else {
        folders = results[0], files = results[1];
        content = folders.concat(files);
        sendResults = function(results) {
          return res.send(200, results);
        };
        if (key != null) {
          isAuthorized = function(element, callback) {
            return sharing.checkClearance(element, req, function(authorized) {
              return callback(authorized && element.clearance !== 'public');
            });
          };
          return async.filter(content, isAuthorized, function(results) {
            return sendResults(results);
          });
        } else {
          return sendResults(content);
        }
      }
    });
  }
};

module.exports.zip = function(req, res, next) {
  var addToArchive, archive, folder, key, makeZip;
  folder = req.folder;
  archive = archiver('zip');
  addToArchive = function(file, cb) {
    var name, stream;
    stream = file.getBinary("file", (function(_this) {
      return function(err, resp, body) {
        if (err) {
          return next(err);
        }
      };
    })(this));
    name = file.path.replace(key, "") + "/" + file.name;
    return archive.append(stream, {
      name: name
    }, cb);
  };
  makeZip = function(zipName, files) {
    async.eachSeries(files, addToArchive, function(err) {
      var disposition;
      if (err) {
        return next(err);
      } else {
        archive.pipe(res);
        disposition = "attachment; filename=\"" + zipName + ".zip\"";
        res.setHeader('Content-Disposition', disposition);
        return res.setHeader('Content-Type', 'application/zip');
      }
    });
    return archive.finalize(function(err, bytes) {
      if (err) {
        return res.send({
          error: true,
          msg: "Server error occured: " + err
        }, 500);
      } else {
        return console.log("Zip created");
      }
    });
  };
  key = "" + folder.path + "/" + folder.name;
  return File.all(function(err, files) {
    var selectedFiles, zipName, _ref;
    if (err) {
      return next(err);
    } else {
      zipName = (_ref = folder.name) != null ? _ref.replace(/\W/g, '') : void 0;
      selectedFiles = files.filter(function(file) {
        return ("" + file.path + "/").indexOf("" + key + "/") === 0;
      });
      return makeZip(zipName, selectedFiles);
    }
  });
};

module.exports.changeNotificationsState = function(req, res, next) {
  var folder;
  folder = req.folder;
  return sharing.limitedTree(folder, req, function(path, rule) {
    var clearance, notif, r, _i, _len, _results;
    if (req.body.notificationsState == null) {
      return next(new Error('notifications must have a state'));
    } else {
      notif = req.body.notificationsState;
      notif = notif && notif !== 'false';
      clearance = path[0].clearance || [];
      _results = [];
      for (_i = 0, _len = clearance.length; _i < _len; _i++) {
        r = clearance[_i];
        if (!(r.key === rule.key)) {
          continue;
        }
        rule.notifications = r.notifications = notif;
        _results.push(folder.updateAttributes({
          clearance: clearance
        }, function(err) {
          if (err != null) {
            return next(err);
          } else {
            return res.send(201);
          }
        }));
      }
      return _results;
    }
  });
};

module.exports.publicList = function(req, res, next) {
  var errortemplate, folder;
  folder = req.folder;
  if (req.accepts('html, json') === 'html') {
    errortemplate = function(err) {
      err = new Error('File not found');
      err.status = 404;
      err.template = {
        name: '404',
        params: {
          localization: require('../lib/localization_manager'),
          isPublic: req.url.indexOf('public') !== -1
        }
      };
      return next(err);
    };
    return sharing.limitedTree(folder, req, function(path, rule) {
      var authorized, key;
      authorized = path.length !== 0;
      if (!authorized) {
        return errortemplate();
      }
      key = "" + folder.path + "/" + folder.name;
      return async.parallel([
        function(cb) {
          return CozyInstance.getLocale(cb);
        }
      ], function(err, results) {
        var html, imports, lang, publicKey;
        if (err) {
          return errortemplate(err);
        }
        lang = results[0];
        publicKey = req.query.key || "";
        imports = "window.rootFolder = " + (JSON.stringify(folder)) + ";\nwindow.locale = \"" + lang + "\";\nwindow.tags = [];\nwindow.canUpload = " + (rule.perm === 'rw') + "\nwindow.publicNofications = " + (rule.notifications || false) + "\nwindow.publicKey = \"" + publicKey + "\"";
        try {
          html = jade.renderFile(template, {
            imports: imports
          });
          return res.send(html);
        } catch (_error) {
          err = _error;
          return errortemplate(err);
        }
      });
    });
  } else {
    return module.exports.find(req, res, next);
  }
};
