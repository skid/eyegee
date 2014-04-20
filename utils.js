/**
 * Helper functions.
**/
var _       = require('underscore');
var crypto  = require('crypto');


// Generates a random 4 digit hex string
function s4() {
  return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
}

// Generates a pretty unique guid.
function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

// Hashes (sha1) a password with a randomly generated salt.
function hashPassword(password){
  var hash, salt = guid();

  hash = crypto.createHash("sha1");
  hash.update(salt + password);

  return salt + ":" + hash.digest("hex");
}

// Compares a password to a hashed and salted password
function comparePasswords(raw, salted){
  var salthash = salted.split(":");
  var hash = crypto.createHash("sha1");
  
  hash.update(salthash[0] + raw);
  return hash.digest("hex") === salthash[1];
}


exports.guid = guid;
exports.hashPassword = hashPassword;
exports.comparePasswords = comparePasswords;