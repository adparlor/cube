// Wrap the callback to add id to each callback when needed.
module.exports = function wrapCallback(callback, queryId) {
  if (!queryId) {
    return callback;
  }

  // Attach `id` to the event or metric if possible
  function wrapper(message) {
    if (callback.closed) {
      return;
    }

    if (message) {
      // Make `id` exist only during the callback, ids should not get mixed between multiple clients.
      message.id = queryId;
      callback(message);
      delete message.id;
    } else {
      callback(message);
    }
  }

  Object.defineProperty(wrapper, 'id', {
    get: function() {
      return callback.id;
    }
  });

  Object.defineProperty(wrapper, 'closed', {
    get: function() {
      return callback.closed;
    }
  });

  return wrapper;
}
