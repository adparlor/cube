'use strict';

// TODO include the event._id (and define a JSON encoding for ObjectId?)
// TODO allow the event time to change when updating (fix invalidation)

var _ = require("underscore"),
    mongodb     = require("mongodb"),
    ObjectID    = mongodb.ObjectID,
    util        = require("util"),
    Event       = require("./models/event"),
    Metric      = require("./models/metric"),
    Invalidator = Metric   = require("./models/invalidator"),
    parser      = require("./event-expression"),
    bisect      = require("./bisect"),
    metalog     = require("./metalog");

// When streaming events, we should allow a delay for events to arrive, or else
// we risk skipping events that arrive after their event.time. This delay can be
// customized by specifying a `delay` property as part of the request.
var streamDelayDefault = 5000,
    streamInterval     = 1000;

// serial id so we can track flushers
var putter_id = 0;

// event.putter -- save the event, invalidate any cached metrics impacted by it.
//
// @param request --
//   - id,   a unique ID (optional). If included, it will be used as the Mongo record's primary key -- if the collector receives that event multiple times, it will only be stored once. If omitted, Mongo will generate a unique ID for you.
//   - time, timestamp for the event (a date-formatted string)
//   - type, namespace for the events. A corresponding `foo_events` collection must exist in the DB -- /schema/schema-*.js illustrate how to set up a new event type.
//   - data, the event's payload
//

exports.putter = function(db, config){
  var options      = (config || options || {});

  var invalidator = new Invalidator();

  function putter(request, callback){
    var time = "time" in request ? new Date(request.time) : new Date(),
        type = request.type;
    callback = callback || function(){};

    // // Drop events from before invalidation horizon
    if ((! request.force) && options.horizons && (time < new Date(new Date() - options.horizons.invalidation))) {
      metalog.info('cube_compute', {error: "event before invalidation horizon"});
      return callback({error: "event before invalidation horizon"}), -1;
    }

    var event = new Event(type, time, request.data, request.id);

    // Save the event, then queue invalidation of its associated cached metrics.
    //
    // We don't invalidate the events immediately. This would cause redundant
    // updates when many events are received simultaneously. Also, having a
    // short delay between saving the event and invalidating the metrics reduces
    // the likelihood of a race condition between when the events are read by
    // the evaluator and when the newly-computed metrics are saved.
    event.save(db, function after_save(error, event){
      if (error) return callback({error: error});
      if (event) invalidator.add(event.type, event);
      callback(event);
    });
  }

  putter.id = ++putter_id;

  // Process any deferred metric invalidations, flushing the queues. Note that
  // the queue (timesToInvalidateByTierByType) is copied-on-write, so while the
  // previous batch of events are being invalidated, new events can arrive.
  Invalidator.start_flusher(putter.id, function(){
    if (db.isHalted) return putter.stop();
    invalidator.flush(db, handle);
    invalidator = new Invalidator(); // copy-on-write
  });

  putter.invalidator = function(){ return invalidator; };
  putter.stop = function(on_stop){
    metalog.info('putter_stopping', {id: putter.id});
    Invalidator.stop_flusher(putter.id, on_stop);
    invalidator = null
  };

  metalog.info('putter_start', {id: putter.id, inv: invalidator});
  return putter;
};

// --------------------------------------------------------------------------

//
// event.getter - subscribe to event type
//
// if `stop` is not given, does a streaming response, polling for results every
// `streamDelay` (5 seconds).
//
// if `stop` is given, return events from the given interval
//
// * convert the request expression and filters into a MongoDB-ready query
// * Issue the query;
// * if streaming, register the query to be run at a regular interval
//
// if `queryId` is provided, every response will be provided with the queryId
// it is meant to help you sort out responses when queries are made on a single ws connection
//
exports.getter = function(db, config) {
  var options      = (config || options || {}),
      streamsBySource = {};

  function getter(request, callback) {
    var stream = !("stop" in request),
        delay = "delay" in request ? +request.delay : streamDelayDefault,
        start = "start" in request ? new Date(request.start) : new Date(0),
        stop = stream ? new Date(Date.now() - delay) : new Date(request.stop);

    // Validate the dates.
    if (isNaN(start)) return callback({error: "invalid start"}), -1;
    if (isNaN(stop)) return callback({error: "invalid stop"}), -1;

    // Convert them to ObjectIDs.
    start = ObjectID.createFromTime(start/1000);
    stop = ObjectID.createFromTime(stop/1000);

    // Parse the expression.
    var expression;
    try {
      expression = parser.parse(request.expression);
    } catch (error) {
      var resp = { error: "invalid expression", expression: request.expression, message: error };
      metalog.info('event_getter', resp);
      return callback({error: "invalid expression", message: error}), -1;
    }

    // Set an optional limit on the number of events to return.
    var options = {sort: {_id: -1}, batchSize: 1000};
    if ("limit" in request) options.limit = +request.limit;
    // Copy any expression filters into the query object.
    var filter = {_id: {$gte: start, $lt: stop}};
    expression.filter(filter);
    // Request any needed fields.
    var fields = {_id:1};
    expression.fields(fields);

    // Query for the desired events.
    function query(callback) {
      db.events(expression.type, function(error, collection){
        handle(error);
        collection.find(filter, fields, options, function(error, cursor) {
          handle(error);
          cursor.each(function(error, event) {
            // If the callback is closed (i.e., if the WebSocket connection was
            // closed), then abort the query. Note that closing the cursor mid-
            // loop causes an error, which we subsequently ignore!
            if (callback.closed) return cursor.close();

            handle(error);
            // A null event indicates that there are no more results.
            if (event) callback({time: event._id.getTimestamp(), data: event.d});
            else       callback(null);
          });
        });
      });
    }

    // For streaming queries, share streams for efficient polling.
    if (stream) {
      var streams = streamsBySource[expression.source],
        initialResponseDone = false,
        anyData = false;

      // If there is an existing stream to attach to, backfill the initial set
      // of results to catch the client up to the stream. Add the new callback
      // to a queue, so that when the shared stream finishes its current poll,
      // it begins notifying the new client. Note that we don't pass the null
      // (end terminator) to the callback, because more results are to come!
      if (streams) {
        filter._id.$lt = streams.time;
        streams.waiting.push(callback);
        query(function(event) {
          if (event) {
            anyData = true;
            callback(event);
          } else {
            // This is the end of the requested chunk, if we had previous data
            // there is no need to report to the client, otherwise let him know
            // we have nothing.
            if (!anyData) {
              callback({ time: filter._id.$lt.getTimestamp(), data: null });
            }
          }
        });
      }

      // Otherwise, we're creating a new stream, so we're responsible for
      // starting the polling loop. This means notifying active callbacks,
      // detecting when active callbacks are closed, advancing the time window,
      // and moving waiting clients to active clients.
      else {
        streams = streamsBySource[expression.source] = {time: stop, waiting: [], active: [callback]};

        (function poll() {
          query(function(event) {

            // If there's an event, send it to all active, open clients.
            if (event) {
              anyData = true;
              streams.active.forEach(function(callback) {
                if (!callback.closed) callback(event);
              });
            }

            // Otherwise, we've reached the end of a poll, and it's time to
            // merge the waiting callbacks into the active callbacks. Advance
            // the time range, and set a timeout for the next poll.
            else {
              // On the 1st request only, tell the client whether we have data or not
              if (!initialResponseDone) {
                initialResponseDone = true;
                if (!anyData) {
                  callback({ time: filter._id.$lt.getTimestamp(), data: null });
                }
              }

              streams.active = streams.active.concat(streams.waiting).filter(open);
              streams.waiting = [];

              // If no clients remain, then it's safe to delete the shared
              // stream, and we'll no longer be responsible for polling.
              if (!streams.active.length) {
                delete streamsBySource[expression.source];
                return;
              }

              filter._id.$gte = streams.time;
              filter._id.$lt = streams.time = new ObjectID((Date.now() - delay)/1000);
              setTimeout(poll, streamInterval);
            }
          });
        })();
      }
    }

    // For non-streaming queries, just send the single batch!
    else query(callback);
  }

  getter.close = function(callback) {
    // as results or periodic calls trigger in the future, ensure that they quit
    // listening and drop further results on the floor.
    callback.closed = true;
  };

  return getter;
};

function open(callback) {
  return !callback.closed;
}

function handle(error) {
  if (!error) return;
  metalog.error('event', error);
  throw error;
}
