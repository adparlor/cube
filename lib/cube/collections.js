// these are the options used when creating the events and metrics collections 

var EVENTS_OPTS =
  {
    capped: true, 
    w: 0, 
    size: 3.146e8 // 300 MB
  };

var METRICS_OPTS = 
  {
    capped: true,
    w: 0,
    size: 3.146e+7, // 30 MB 
    autoIndexId: true
  };


// need to give the module a Mongo Db instance to work on
module.exports = function (db) {
  var cache = {};

  // this is what we're really exporting; has two functions:
  //   events(type, callback) : retrieves or creates the events collection for the given type
  //   metrics(type, callback) : retrieves or creates the metrics collection for the given type
  var collections = {};

  collections.events = function (type, callback) {
    ensureCollection('events', type, EVENTS_OPTS, function (coll) {
      // Events are indexed by time.
      coll.ensureIndex({"t": 1}, throwOnError);
      callback(coll);
    });
  };

  collections.metrics = function (type, callback) {
    ensureCollection('metrics', type, METRICS_OPTS, function (coll) {
      // Three indexes are required: one for finding metrics, one (_id) for updating,
      // and one for invalidation.
      coll.ensureIndex({"i": 1, "_id.e": 1, "_id.l": 1, "_id.t": 1}, throwOnError);
      coll.ensureIndex({"i": 1, "_id.l": 1, "_id.t": 1}, throwOnError);
      callback(coll);
    });
  };

  function ensureCollection(purpose, type, options, callback) {
    var collName = type + "_" + purpose;
    if (cache[type] && cache[type][purpose]) {
      callback(cache[type][purpose]);
    } else if (cache[type] && cache[type][purpose + "_creating"] instanceof Array) {
      console.log("queuing action ",cache[type][purpose + "_creating"].length," while creating ",collName);
      cache[type][purpose + "_creating"].push(callback);
    } else {
      cache[type] = cache[type] || {};

      var queue = cache[type][purpose + "_creating"] = [];

      function gotCollection(coll) {
        cache[type][purpose] = coll;

        queue.forEach(function (q,i) { setTimeout(function () { console.log("executing queued action",i," for ",collName); q(coll); }); });
        cache[type][purpose + "_creating"] = null;

        callback(coll);

      }

      db.collectionNames(collName, function (err, res) {
        if (err) {
          console.error("Couldn't fetch list of collection names while checking ",collName);
        }

        if (res.length > 0) {
          console.log(collName,"already exists");
          gotCollection(db.collection(collName));;
        } else {
          console.log("creating ",collName);
          db.createCollection(collName, options, function(err, coll) {
            if (err) {
              console.error("Couldn't create "+purpose+" collection '"+collName+"':", err);
            }
            gotCollection(coll);
          });
        }
      });
    }
  }

  function throwOnError(err, res) {
    if (err) {
      throw err;
    }
  }


  return collections;
}
