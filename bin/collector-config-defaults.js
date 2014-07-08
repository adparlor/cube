module.exports = {
  mongodb: {
    'mongo-host': '127.0.0.1',
    'mongo-port': 27017,
    'mongo-database': 'cube',
    'mongo-username': null,
    'mongo-password': null,
    'mongo-server-options': {
      auto_reconnect: true,
      poolSize: 8,
      socketOptions: {
        noDelay: true
      }
    },

    'mongo-metrics': {
      autoIndexId: true,
      capped: true,
      size: 2.09716e8, // 200 MB
      safe: false
    },

    'mongo-events': {
      autoIndexId: true,
      capped: true,
      size: 1.0486e8, // 100 MB
      safe: false
    },

    'separate-events-database': true,

    'authentication-collection': 'users'
  },
  horizons: {
    'calculation': 1000 * 60 * 60 * 2, // 2 hours
    'invalidation': 1000 * 60 * 60 * 1, // 1 hour
    'forced_metric_expiration': 1000 * 60 * 60 * 24 * 7, // 7 days
  },
  'collectd-mappings': {
    'snmp': {
      'if_octets': 'interface',
      'disk_octets': 'disk',
      'swap_io': 'swap',
      'swap': 'swap'
    }
  },

  'http-port': 1080,
  'udp-port': 1180,
  'authenticator': 'allow_all'
};
