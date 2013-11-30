// Amazon s3-based backend for uploadfs. See also
// local.js.

var fs = require('fs');
var knox = require('knox');
var extname = require('path').extname;
var contentTypes;
var client;
var https;
var bucket;

var self = module.exports = {
  init: function(options, callback) {
    client = knox.createClient(options);
    if (options.contentTypes) {
      contentTypes = options.contentTypes;
    } else {
      contentTypes = require(__dirname + '/contentTypes.js');
    }
    bucket = options.bucket;
    https = options.https;
    return callback(null);
  },

  copyIn: function(localPath, path, options, callback) {
    var ext = extname(path);
    if (ext.length) {
      ext = ext.substr(1);
    }
    var contentType = contentTypes[ext];
    if (!contentType) {
      contentType = 'application/octet-stream';
    }
    client.putFile(localPath, path, { 'x-amz-acl': 'public-read', 'Content-Type': contentType }, callback);
  },

  // getFile does not copy to a local file, it fetches the whole thing into memory.
  // Since we don't want that, implement streaming with client.get()

  copyOut: function(path, localPath, options, callback) {
    client.get(path).on('response', function(res) {
      if ((res.statusCode < 200) || (res.statusCode >= 300)) {
        return callback(res.statusCode);
      }
      var out = fs.createWriteStream(localPath);
      res.pipe(out);
      var dead = false;
      function die(err) {
        if (!dead) {
          dead = true;
          res.end();
          out.end();
          return callback(err);
        }
      }
      res.on('error', function(err) {
        return die(err);
      });
      out.on('error', function(err) {
        return die(err);
      });
      out.on('close', function() {
        if (!dead) {
          return callback(null);
        }
      });
    }).on('error', function(err) {
      return callback(err);
    }).end();
  },

  remove: function(path, callback) {
    client.deleteFile(path, function(err, res) {
      callback(err);
    });
  },

  getUrl: function(path) {
    return (https ? 'https://' : 'http://') + bucket + '.s3.amazonaws.com';
  }
};
