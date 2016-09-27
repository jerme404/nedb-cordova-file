/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's the device file system, exposed via the `cordova-file` plugin
 *
 * This version is the browser version
 */

var storage = {
  exists (_path, cb) {
    if (_path.indexOf('.') > 0) {
      _getFile(_path, false, (err, file) => cb(!!file && !err));
    } else {
      _getDir(this._rootFS, _path, false, (err, dir) => cb(!!dir && !err));
    }
  },
  rename (oldPath, newPath, cb) {
    var oldDirPath = oldPath.split('/');
    var newDirPath = newPath.split('/');
    var oldFilename = oldDirPath.pop();
    var newFilename = newDirPath.pop();
    oldDirPath = oldDirPath.join('/');
    newDirPath = newDirPath.join('/');

    if (oldPath.indexOf('.') > 0) {
      // move/rename file
      if (!newDirPath || oldDirPath === newDirPath) {
        // rename file
        _renameFile(oldPath, newPath, cb);
      } else {
        // move file
        _moveFile(oldPath, newPath, cb);
      }
    } else {
      // move/rename directory
      if (!newDirPath || oldDirPath === newDirPath) {
        // rename directory
        _renameDir(oldPath, newPath, cb);
      } else {
        // move directory
        _moveDir(oldPath, newPath, cb);
      }
    }
  },
  writeFile (file, data, cb, isAppend) {
    if (typeof file === 'string') {
      _getFile(file, true, (err, fileObject) => fileObject ? _writeFile(fileObject, data, !!isAppend, cb) : cb(err));
    } else {
      _writeFile(file, data, !!isAppend, cb);
    }
  },
  unlink (path, cb) {
    if (_path.indexOf('.') > 0) {
      _getFile(_path, false, (err, file) => file ? _removeFile(file, cb) : cb());
    } else {
      _getDir(this._rootFS, _path, false, (err, dir) => dir ? _removeDir(dir, cb) : cb());
    }
  },
  appendFile (file, data, cb) {
    this.writeFile(file, data, cb, true);
  },
  readFile (file, cb) {
    if (typeof file === 'string') {
      _getFile(file, true, (err, fileObject) => !err ? _readFile(fileObject, cb) : cb(err));
    } else {
      _readFile(file, cb);
    }
  },
  mkdirp (_path, cb) {
    _getDir(this._rootFS, _path, true, cb);
  },
  init (rootPath, cb) {
    window.resolveLocalFileSystemURL(rootPath, (rootFS) => cb(null, (this._rootFS = rootFS)), cb);
  }
};

function _readFile (fileObject, cb) {
  fileObject.file(function (file) {
    var reader = new FileReader();
    reader.onloadend = function () {
      cb(null, this.result);
    };
    reader.onerror = cb;
    reader.readAsText(file);
  }, cb);
}

function _writeFile (fileObject, date, isAppend, cb) {
  fileObject.createWriter(function (fileWriter) {
    fileWriter.onwriteend = function (res) {
      cb(null, res);
    };
    fileWriter.onerror = cb;

    var blob = new Blob([data], { type: 'text/plain' });
    if (isAppend) {
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
  fileObject.remove((() => cb()), cb);
}

function _removeDir (_path, cb) {
  _getDir(storage._rootFS, _path, false, (err, dir) => !err ? dir.remove((() => cb()), cb) : cb(err));
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
  if (paths[paths.length - 1].indexOf('.') > 0) {
    paths.pop(); // remove the file part of the path so we dont create a dir with filename
  }
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
    _getDir(storage._rootFS, _path, true, (err, dir) => {
      dir.getFile(paths[paths.length - 1], { create }, ((file) => cb(null, file)), cb);
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
