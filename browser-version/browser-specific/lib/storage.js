/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's the device file system, exposed via the `cordova-file` plugin
 *
 * This version is the browser version
 */

var storage = {
  exists (_path, cb) {
    _getFile(_path, false, (err, file) => {
      if (err) {
        _getDir(this._rootFS, _path, false, (er, dir) => {
          cb(!!dir && !er)
        });
      } else {
        cb(!!file && !err);
      }
    });
  },
  rename (oldPath, newPath, cb) {
    var oldDirPath = oldPath.split('/');
    var newDirPath = newPath.split('/');
    var oldFilename = oldDirPath.pop();
    var newFilename = newDirPath.pop();
    oldDirPath = oldDirPath.join('/');
    newDirPath = newDirPath.join('/');

    // if (oldPath.indexOf('.') > 0) {
      // move/rename file
      if (!newDirPath || oldDirPath === newDirPath) {
        // rename file
        _renameFile(oldPath, newPath, cb);
      } else {
        // move file
        _moveFile(oldPath, newPath, cb);
      }
    // } else {
    //   // move/rename directory
    //   if (!newDirPath || oldDirPath === newDirPath) {
    //     // rename directory
    //     _renameDir(oldPath, newPath, cb);
    //   } else {
    //     // move directory
    //     _moveDir(oldPath, newPath, cb);
    //   }
    // }
  },
  writeFile (file, data, encoding, cb, isAppend) {
    if (encoding === 'utf8') encoding = 'UTF-8';
    if (typeof file === 'string') {
      _getFile(file, true, (err, fileObject) => {
        if (!err) {
          _writeFile(fileObject, data, encoding, cb, !!isAppend);
        } else {
          cb(err);
        }
      });
    } else {
      _writeFile(file, data, encoding, cb, !!isAppend);
    }
  },
  unlink (_path, cb) {
    _getFile(_path, false, (err, file) => {
      if (err) {
        _getDir(this._rootFS, _path, false, (er, dir) => {
          if (!er) {
            _removeDir(dir, cb);
          } else {
            cb(er);
          }
        });
      } else {
        if (file) {
          _removeFile(file, cb);
        } else {
          cb(err);
        }
      }
    });
  },
  appendFile (file, data, encoding, cb) {
    if (encoding === 'utf8') encoding = 'UTF-8';
    this.writeFile(file, data, encoding, cb, true);
  },
  readFile (file, encoding, cb) {
    if (encoding === 'utf8') encoding = 'UTF-8';
    if (typeof file === 'string') {
      _getFile(file, true, (err, fileObject) => {
        if (!err) {
          _readFile(fileObject, encoding, cb);
        } else {
          cb(err);
        }
      });
    } else if (file.isFile) {
      _readFile(file, encoding, cb);
    }
  },
  mkdirp (_path, cb) {
    _getDir(this._rootFS, _path, true, cb);
  },
  init (rootPath, cb) {
    window.resolveLocalFileSystemURL(rootPath, (rootFS) => {
      cb(null, (this._rootFS = rootFS));
    }, cb);
  }
};

function _readFile (fileObject, encoding, cb) {
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = 'utf8';
  }
  fileObject.file(function (file) {
    var reader = new FileReader();
    reader.onloadend = function () {
      cb(null, this.result);
    };
    reader.onerror = cb;
    reader.readAsText(file, encoding || 'UTF-8');
  }, cb);
}

function _writeFile (fileObject, data, encoding, cb, isAppend) {
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = 'utf8';
    isAppend = cb;
  }
  fileObject.createWriter(function (fileWriter) {
    fileWriter.onwriteend = function (res) {
      cb(null, res);
    };
    fileWriter.onerror = cb;

    var blob = new Blob([data], { type: 'text/plain', encoding: "UTF-8", endings: 'native' });
    if (isAppend && typeof isAppend === 'boolean') {
      try {
        fileWriter.seek(fileWriter.length);
        fileWriter.write(blob);
      } catch (e) {
        cb(e);
      }
    } else {
      fileWriter.write(blob);
    }
  }, cb);
}

function _removeFile (fileObject, cb) {
  fileObject.remove(() => {
    cb();
  }, cb);
}

function _removeDir (_path, cb) {
  if (typeof _path === 'string') {
    _getDir(storage._rootFS, _path, false, (err, dir) => {
      if (!err) {
        dir.removeRecursively(() => {
          cb();
        }, cb);
      } else {
        cb(err);
      }
    });
  } else {
    _path.removeRecursively(() => {
      cb();
    }, cb);
  }
}

function _renameFile (oldPath, newName, cb) {
  var paths = oldPath.split('/');
  var filename = paths.pop();
  var newFilename = newName.split('/').pop();
  _getDir(storage._rootFS, oldPath, false, (err, dir) => {
    if (err) return cb(err);
    dir.getFile(filename, {}, (fileEntry) => {
      fileEntry.moveTo(dir, newFilename);
      cb(null, newFilename);
    }, cb);
  });
}

function _renameDir (oldPath, newName, cb) {
  // var paths = oldPath.split('/');
  // var filename = paths.pop();
  // var newFilename = newName.split('/').pop();
  // _getDir(storage._rootFS, oldPath, false, (err, dir) => {
  //  if (!err) {
  //    dir.getFile(filename, {}, (fileEntry) => {
  //      fileEntry.moveTo(dir, newFilename);
  //      cb(null, newFilename);
  //    });
  //  } else {
  //    cb(err);
  //  }
  // });
}

function _moveFile (oldPath, newName, cb) {
  var paths = oldPath.split('/');
  var filename = paths.pop();
  var newPaths = newName.split('/');
  var newFilename = newPaths.pop();
  _getDir(storage._rootFS, newName, true, (err, newDir) => {
    if (err) return cb(err);
    _getFile(oldPath, false, (er, fileEntry) => {
      if (er) return cb(er);
      fileEntry.moveTo(newDir, newFilename);
      cb(null, newName);
    });
  });
}

function _moveDir (oldPath, newName, cb) {

}

function _getDir (cwdFS, _path, create, cb) {
  if (_path.charAt(0) == '.' || _path.charAt(0) == '/') {
    _path = _path.slice(1);
  }
  var paths = _path.split('/');
  cwdFS.getDirectory(paths[0], { create }, (dataDir) => {
    if (paths.length > 1) {
      return _getDir(dataDir, paths.slice(1).join('/'), !!create, cb);
    }
    return cb(null, dataDir);
  }, cb);
}

function _getFile (_path, create, cb) {
  var paths = _path.split('/');
  if (paths.length === 1) {
    storage._rootFS.getFile(_path, { create }, (file) => cb(null, file), cb);
  } else {
    _getDir(storage._rootFS, paths.slice(0, paths.length - 1).join('/'), true, (err, dir) => {
      dir.getFile(paths[paths.length - 1], { create }, (file) => cb(null, file), cb);
    });
  }
}

function _ensureInit(cb) {
  if (!storage._rootFS) {
    console.warn('Storage not initialized. Call `storage.init(rootFsUrl, callback)`.');
    if (typeof cordova !== 'undefined' && cordova.file) {
      console.warn('Using `cordova.file.dataDirectory` until `storage.init` called with new root directory.');
      storage.init.apply(storage, [cordova.file.dataDirectory, cb]);
    } else {
      throw 'Storage not initialized. Call `storage.init(rootFsUrl, callback)`.';
    }
  } else {
    cb(storage._rootFS);
  }
}

storage.ensureFileDoesntExist = function (file, callback) {
  storage.exists(file, function (exists) {
    if (!exists) { return callback(null); }

    storage.unlink(file, function (err) { return callback(err); });
  });
};


storage.ensureDatafileIntegrity = function (filename, callback) {
  var tempFilename = filename + '~';

  storage.exists(filename, function (filenameExists) {
    // Write was successful
    if (filenameExists) { return callback(null); }

    storage.exists(tempFilename, function (oldFilenameExists) {
      // New database
      if (!oldFilenameExists) {
        return storage.writeFile(filename, '', function (err) { callback(err); });
      }

      // Write failed, use old version
      storage.rename(tempFilename, filename, function (err) { return callback(err); });
    });
  });
};

// wrap methods with `_ensureInit` for convenience
for (var methodName in storage) {
  if (storage.hasOwnProperty(methodName) && methodName !== 'init') {
    (function (methodName) {
      var originalFn = storage[methodName];
      var wrappedFn = function () {
        var args = Array.prototype.slice.call(arguments);
        _ensureInit(() => {
          originalFn.apply(this, args)
        });
      };
      storage[methodName] = wrappedFn.bind(storage);
    })(methodName);
  }
}


// Interface
module.exports.exists = storage.exists;
module.exports.rename = storage.rename;
module.exports.writeFile = storage.writeFile;
module.exports.crashSafeWriteFile = storage.writeFile;   // No need for a crash safe function in the browser
module.exports.appendFile = storage.appendFile;
module.exports.readFile = storage.readFile;
module.exports.unlink = storage.unlink;
module.exports.mkdirp = storage.mkdirp;
module.exports.ensureFileDoesntExist = storage.ensureFileDoesntExist;
module.exports.ensureDatafileIntegrity = storage.ensureDatafileIntegrity;
