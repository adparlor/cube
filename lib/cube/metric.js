'use strict';

// TODO use expression ids or hashes for more compact storage

var _ = require("underscore"),
    util           = require("util"),
    queuer         = require("queue-async/queue"),
    parser         = require("./metric-expression"),
    tiers          = require("./tiers"),
    reduces        = require("./reduces"),
    Metric         =  require("./models/metric"),
    Measurement    = require("./models/measurement"),
    event          = require("./event"),
    metalog        = require('./metalog'),
    hasher         = require('./expression-hasher');

// When streaming metrics, we should allow a delay for events to arrive, or else
// we risk skipping events that arrive after their event time.
var streamDelayDefault = 7000,
    streamInterval = 1000;

// Query for metrics.

exports.getter = function(db) {
  var streamsBySource = {};

  function getter(request, callback) {
    var measurement, expression,
        stream = request.stop === undefined,
        tier   = tiers[+request.step],
        start  = new Date(request.start),
        stop   = new Date(request.stop);

    try {
      if (!tier)                   throw "invalid step";
      if (isNaN(start))            throw "invalid start";
      if (isNaN(stop)) {
        if (stream) {
          // Set stop to the latest possible time in stream mode
          stop = new Date(Date.now() - streamDelayDefault);
        } else {
          throw "invalid stop";
        }
      }

      // Round start and stop to the appropriate time step.
      start       = tier.floor(start);
      stop        = tier[ stream ? 'floor' : 'ceil' ](stop);
      expression  = parser.parse(request.expression);
      measurement = new Measurement(expression, start, stop, tier);
    } catch(error) {
      metalog.error('mget', error, { info: util.inspect([start, stop, tier, expression]) });
      return callback({error: error, _trace: request._trace}), -1;
    }

    if (stream) {
      var streamKey = hasher.hash(request.expression) + '#' + tier.key;
      streamer(streamKey, measurement, callback);
    } else {
      measurement.on('complete', function(){ callback(new Metric({time: stop, value: null}, measurement)); });
      measurement.measure(db, callback);
    }
  }

  function streamer(streamKey, measurement, callback) {
    function broadcastMetrics(metric) {
      stream.active.forEach(function(callback) {
        if (!callback.closed) {
          callback(metric);
        }
      });
    }

    var stream = streamsBySource[streamKey],
        metrics = [];

    if (stream) {
      // A poll function already exists for this streamKey,
      // get the previously computed data and add ourselve to the stream.
      measurement.stop = stream.measurement.start;
      stream.active.push(callback);
      measurement.measure(db, callback);
    } else {
      // No poll function exist for this streamKey, let's create a new one.
      stream = streamsBySource[streamKey] = {
        measurement: measurement,
        active: [callback]
      };

      measurement.on('complete', function() {
        stream.active = stream.active.filter(open);

        if(!stream.active.length) {
          delete streamsBySource[streamKey];
          return;
        }

        // Previous stops becomes our new start, the new stop gets a tier added,
        // then we ask for this computation on the next stop time + delay.
        // Note that the timeout might be negative in case of overload,
        // though that should not matter much.
        measurement.start = stream.stop;
        measurement.stop = new Date (+stream.stop + measurement.tier.key);
        setTimeout(function() {
          measurement.measure(db, broadcastMetrics);
        }, +measurement.stop + streamDelayDefault - Date.now());
      });

      measurement.measure(db, broadcastMetrics);
    }
  }

  getter.close = function(callback) {
    callback.closed = true;
  };

  return getter;
};

function open(callback) {
  return !callback.closed;
}

function handle(error) {
  if (!error) return;
  metalog.error('metric', error);
  throw error;
}
