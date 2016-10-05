/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's the device file system, exposed via the `cordova-file` plugin
 *
 * This version is the browser version
 */

var storage = {};

storage.exists = function exists (_path, cb) {
  _getFile(_path, false, function (err, file) {
    if (err) {
      return _getDir(storage._rootFS, _path, false, function (er, dir) { return cb(!!dir && !er) });
    }
    return cb(!!file && !err);
  });
}

storage.rename = function rename (oldPath, newPath, cb) {
  var oldDirPath = oldPath.split('/');
  var newDirPath = newPath.split('/');
  var oldFilename = oldDirPath.pop();
  var newFilename = newDirPath.pop();
  oldDirPath = oldDirPath.join('/');
  newDirPath = newDirPath.join('/');

  if (!newDirPath || oldDirPath === newDirPath) {
    return _renameFile(oldPath, newPath, cb);
  }
  return _moveFile(oldPath, newPath, cb);
}

storage.writeFile = function writeFile (file, data, encoding, cb, isAppend) {
  if (encoding === 'utf8') encoding = 'UTF-8';
  if (typeof file === 'string') {
    return _getFile(file, true, function (err, fileObject) {
      if (err) { return cb(err) }
      return _writeFile(fileObject, data, encoding, cb, !!isAppend);
    });
  }
  return _writeFile(file, data, encoding, cb, !!isAppend);
}

storage.unlink = function unlink (_path, cb) {
  _getFile(_path, false, function (err, file) {
    if (err) {
      return _getDir(storage._rootFS, _path, false, function (er, dir) {
        if (er) { return cb(er) }
        return _removeDir(dir, cb);
      });
    }
    return _removeFile(file, cb);
  });
}

storage.appendFile = function appendFile (file, data, encoding, cb) {
  if (encoding === 'utf8') encoding = 'UTF-8';
  return writeFile(file, data, encoding, cb, true);
}

storage.readFile = function readFile (file, encoding, cb) {
  if (encoding === 'utf8') encoding = 'UTF-8';
  if (typeof file === 'string') {
    _getFile(file, true, function (err, fileObject) {
      if (err) { return cb(err); }
      return _readFile(fileObject, encoding, cb);
    });
  } else if (file.isFile) {
    return _readFile(file, encoding, cb);
  }
}

storage.mkdirp = function mkdirp (_path, cb) {
  _getDir(storage._rootFS, _path, true, cb);
}

storage.ensureFileDoesntExist = function ensureFileDoesntExist(file, callback) {
  storage.exists(file, function (exists) {
    if (!exists) { return callback(null); }

    storage.unlink(file, function (err) { return callback(err); });
  });
};


storage.ensureDatafileIntegrity = function ensureDatafileIntegrity(filename, callback) {
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

storage.init = function init (rootPath, cb) {
  window.resolveLocalFileSystemURL(rootPath, function (rootFS) {
    cb(null, (storage._rootFS = rootFS));
  }, cb);
}



/**
 * helpers
 */

function _readFile (fileObject, encoding, cb) {
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = 'UTF-8';
  }
  fileObject.file(function (file) {
    var reader = new FileReader();
    reader.onloadend = function (e) {
      cb(null, e.target.result);
    };
    reader.onerror = cb;
    reader.readAsText(file, encoding || 'UTF-8');
  }, cb);
}

function _writeFile (fileObject, data, encoding, cb, isAppend) {
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = 'UTF-8';
    isAppend = cb;
  }
  fileObject.createWriter(function (fileWriter) {
    fileWriter.onwriteend = function (e) {
      cb(e.error);
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
  fileObject.remove(function () { cb() }, cb);
}

function _removeDir (_path, cb) {
  if (typeof _path === 'string') {
    _getDir(storage._rootFS, _path, false, function (err, dir) {
      if (!err) {
        dir.removeRecursively(function () { cb() }, cb);
      } else {
        cb(err);
      }
    });
  } else {
    _path.removeRecursively(function () { cb() }, cb);
  }
}

function _renameFile (oldPath, newName, cb) {
  var paths = oldPath.split('/');
  var filename = paths.pop();
  var newFilename = newName.split('/').pop();
  _getDir(storage._rootFS, oldPath, false, function (err, dir) {
    if (err) return cb(err);
    dir.getFile(filename, {}, function (fileEntry) {
      fileEntry.moveTo(dir, newFilename);
      cb(null, newFilename);
    }, cb);
  });
}

function _renameDir (oldPath, newName, cb) {
  // var paths = oldPath.split('/');
  // var filename = paths.pop();
  // var newFilename = newName.split('/').pop();
  // _getDir(storage._rootFS, oldPath, false, function (err, dir) {
  //  if (!err) {
  //    dir.getFile(filename, {}, function (fileEntry) {
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
  _getDir(storage._rootFS, newName, true, function (err, newDir) {
    if (err) return cb(err);
    _getFile(oldPath, false, function (er, fileEntry) {
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
  cwdFS.getDirectory(paths[0], { create: create }, function (dataDir) {
    if (paths.length > 1) {
      return _getDir(dataDir, paths.slice(1).join('/'), !!create, cb);
    }
    return cb(null, dataDir);
  }, cb);
}

function _getFile (_path, create, cb) {
  var paths = _path.split('/');
  if (paths.length === 1) {
    storage._rootFS.getFile(_path, { create: create }, function (file) { cb(null, file) }, cb);
  } else {
    _getDir(storage._rootFS, paths.slice(0, paths.length - 1).join('/'), true, function (err, dir) {
      dir.getFile(paths[paths.length - 1], { create: create }, function (file) { cb(null, file) }, cb);
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


// wrap methods with `_ensureInit` for convenience
for (var methodName in storage) {
  if (storage.hasOwnProperty(methodName) && methodName !== 'init') {
    (function (methodName) {
      var originalFn = storage[methodName];
      var wrappedFn = function () {
        var args = Array.prototype.slice.call(arguments);
        _ensureInit(function () { originalFn.apply(this, args) });
      };
      storage[methodName] = wrappedFn.bind(storage);
    })(methodName);
  }
}


// Interface
module.exports = storage;
module.exports.crashSafeWriteFile = storage.writeFile;   // No need for a crash safe function in the browser
