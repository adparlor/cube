var crypto = require('crypto'),
    _ = require('underscore');

// Regexp to remove whitespaces other than inside nested strings
// Known limitations :
//   - Fails when another token (' or ") is inside a string (ie. "'" or '"')
var whitespaceRemover = / *([^ \"']*) *((\"|')(?:[^\\\\\"']|\\\\.)*(\"|'))?/g;

function shasum (string) {
  var sha512 = crypto.createHash('sha512');
  sha512.update(string);
  return sha512.digest('base64');
}


// Ease debugging of metrics after they have been hashed by storing equivalencies.
var hashesColl;
function save (original, hashed) {
  if (hashesColl) {
    hashesColl.update({ original: original }, { original: original, hashed: hashed }, { upsert: true, w: 0 });
  } else if (hasher.db) {
    hasher.db.collection('formulaHashes', function (err, collection) {
      if (err) return; // This is not critical, better luck next time
      hashesColl = collection;
      save(original, hashed);
    });
  }
}

//
// Deep explore expression to substitute their formula with a hash
// that's usable inside a mongodb _id.
//
function hashExpression (expression) {
  // Workaround for https://jira.mongodb.org/browse/SERVER-4271
  // Because expression is in the sharding key, heavy formulas are not persisted
  // So we change the expression to be stripped from spaces, then put it in the form
  // "length sha512"
  var hashed = expression.replace(whitespaceRemover, '$1$2');
  hashed = hashed.length + ' ' + shasum(hashed);
  save(expression, hashed);
  return hashed;
}

var hasher = module.exports = {
  db: null, // To be initialized by the server
  hash: _.memoize(hashExpression)
};
