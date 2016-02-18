/**
 * Created by westopher on 9/22/15.
 */
var amqp        = require('amqplib/callback_api')
  , Q           = require('q')
  , PubSub      = require('./PubSub')
  , Routed      = require('./Routed')
  , RPC         = require('./RPC')
  , Topic       = require('./Topic')
  , WorkQueue   = require('./WorkQueue');

/**
 * Main service pattern constructor
 *
 * @param namespace
 * @constructor
 */
function Patterns (namespace) {
    this.namespace(namespace);
    this.patterns = [];
    this.rpc_calls = [];
}
/**
 * Sets the current namespace of the service being declared
 *
 * @param namespace
 * @returns {Patterns}
 */
Patterns.prototype.namespace = function (namespace) {
    this.namespace = namespace;
    return this;
};
/**
 * Builds a new worker queue on the current service
 *
 * @param queue
 * @param callback
 * @returns {Patterns}
 */
Patterns.prototype.workQueue = function (queue, callback) {
    var _this = this;
    queue = this.getQueueString(queue);
    var wq = new WorkQueue(queue, callback);
    return {
        then: function (callback) {
            _this.patterns.push(
                wq
                    .consume()
                    .then(function (msg) {
                        return callback(msg);
                    })
            )
        }
    };
};
/**
 * Builds a new subscription via the publish/subscribe pattern on the current service.
 *
 * @param exchange
 * @param callback
 * @returns {Patterns}
 */
Patterns.prototype.pubSub = function (exchange, callback) {
    var _this = this;
    exchange = this.getExchangeString(exchange);
    var ps = new PubSub(exchange, callback);
    this.patterns.push(ps);
    return {
        then: function (callback) {
            _this.patterns.push(
                ps
                    .consume()
                    .then(function (msg) {
                        return callback(msg);
                    })
            )
        }
    };
};
/**
 * Builds a new routed exchange pattern on the current service
 *
 * @param exchange
 * @param routes
 * @param callback
 * @returns {Patterns}
 */
Patterns.prototype.routed = function (exchange, routes) {
    var _this = this;
    exchange = this.getExchangeString(exchange);
    var routed = new Routed(exchange, routes);
    return {
        then: function (callback) {
            _this.patterns.push(
                routed
                    .consume()
                    .then(function (msg) {
                        return callback(msg);
                    })
            )
        }
    };
};
/**
 * Builds a new topic based exchange on the current service.
 *
 * @param exchange
 * @param topics
 * @param callback
 * @returns {Patterns}
 */
Patterns.prototype.topic = function (exchange, topics) {
    var _this = this;
    exchange = this.getExchangeString(exchange);
    var topic = new Topic(exchange, topics);
    return {
        then: function (callback) {
            _this.patterns.push(
                topic
                    .consume()
                    .then(function (msg) {
                        return callback(msg);
                    })
            );
        }
    };
};
/**
 * Builds a new RPC queue on the current service.  RPC allows services to return data to the client.
 * @param queue
 * @param callback
 * @returns {Patterns}
 */
Patterns.prototype.rpc = function (queue) {
    var _this = this;
    queue = this.getRpcString(queue);
    var rpc = new RPC(queue);
    this.rpc_calls.push(rpc);
    return {
        then: function (callback) {
            _this.patterns.push(
                rpc
                    .consume()
                    .then(function (results) {
                        return callback(results);
                    })
            );
        }
    };
};
/**
 * Initializer function for the AMQP service.  Registers all patterns in memory with the amqp provider
 *
 * @param callback
 */
Patterns.prototype.init = function () {
    var deferred = Q.defer()
        , _this = this;

    var daemons = this.patterns.concat(this.rpc_calls);

    return this
        .connect()
        .then(function (conn) {
            return Q.all(daemons.map(function (daemon) {
                daemon.consume(conn);
            }));
        });
};
/**
 * Broadcast data to a particular queue
 *
 * @param queue
 * @param args
 */
Patterns.prototype.broadcast = function (queue, args) {
    queue = this.getQueueString(queue);
    return this
        .connect()
        .then(createChannel)
        .spread(function (channel, conn) {
            var input = stringifyJson(args);
            channel.assertQueue(queue, {durable: true});
            channel.sendToQueue(queue, new Buffer(input), {persistent: true});
            conn.close();
        });
};
/**
 * Publish data to a particular queue
 *
 * @param exchange
 * @param args
 */
Patterns.prototype.publish = function (exchange, args) {
    exchange = this.getExchangeString(exchange);
    return this
        .connect()
        .then(createChannel)
        .then(function (channel, conn) {
            var input = stringifyJson(args);
            channel.assertExchange(exchange, 'fanout', {durable: false});
            channel.publish(exchange, '', new Buffer(input));
            conn.close();
        })
        .done();
};

Patterns.prototype.callRpc = function (rpc_string, args) {
    rpc_string = this.namespace + '.rpc.' + rpc_string;
    return this
        .rpcConnect(rpc_string, args)
        .spread(this.createRpcChannel)
        .spread(this.assertRpcQueue)
};

Patterns.prototype.assertRpcQueue = function (channel, conn, rpc_string, args) {
    var deferred = Q.defer()
        , _this = this;

    channel.assertQueue('', {exclusive: true}, function(err, q) {

        if (err) {
            deferred.reject(err);
        }

        var corr = generateUuid();
        var input = stringifyJson(args);

        channel.consume(q.queue, function(msg) {
            if (msg.properties.correlationId == corr) {
                deferred.resolve(msg);
                conn.close();
            }
        }, {noAck: true});

        channel.sendToQueue(
            rpc_string,
            new Buffer(input),
            { correlationId: corr, replyTo: q.queue }
        );
    });
    return deferred.promise;
};


Patterns.prototype.connect = function () {
    var deferred = Q.defer()
        , _this = this;
    amqp.connect('amqp://localhost', function (err, conn) {
        if (err) return deferred.reject(err);
        deferred.resolve(conn);
    });
    return deferred.promise;
};

Patterns.prototype.rpcConnect = function (rpc_string, args) {
    var deferred = Q.defer()
        , _this = this;
    amqp.connect('amqp://localhost', function (err, conn) {
        if (err) return deferred.reject(err);
        deferred.resolve([conn, rpc_string, args]);
    });
    return deferred.promise;
};

Patterns.prototype.createRpcChannel = function (conn, rpc_string, args) {
    var deferred = Q.defer()
        , _this = this;
    conn.createChannel(function (err, channel) {
        if (err) return deferred.reject(err);
        deferred.resolve([channel, conn, rpc_string, args]);
    });
    return deferred.promise;
};

Patterns.prototype.createChannel = function (conn, rpc_string) {
    var deferred = Q.defer()
      , _this = this;
    conn.createChannel(function (err, channel) {
        if (err) return deferred.reject(err);
        deferred.resolve([channel, conn]);
    });
    return deferred.promise;
};

Patterns.prototype.getQueueString = function (queue) {
    return this.namespace + '.' + queue;
};

Patterns.prototype.getExchangeString = function (exchange) {
    return this.namespace + '.' + exchange;
};

Patterns.prototype.getRpcString = function (rpc) {
    return this.namespace + '.rpc.' + rpc;
};

/**
 * Export our service
 *
 * @param namespace
 * @returns {Patterns}
 */
module.exports = function (namespace) {
    return new Patterns(namespace);
};
/**
 * Convert a JSON string to JavaScript object
 *
 * @param string
 * @returns {{}}
 */
function parseJson (string) {
    try {
        var json_obj = JSON.parse(string);
        return json_obj;
    } catch (e) {
        return {};
    }
}
/**
 * Convert a JavaScript object to JSON string
 *
 * @param object
 */
function stringifyJson (object) {
    try {
        var json_string = JSON.stringify(object);
        return json_string;
    } catch (e) {
        return JSON.stringify({});
    }
}
/**
 * Generate a random ID for correlation strings in RabbitMQ for RPC calls
 * 
 * @returns {string}
 */
function generateUuid() {
    return Math.random().toString() +
        Math.random().toString() +
        Math.random().toString();
}