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
    queue = this.namespace + '.' + queue;
    var wq = new WorkQueue(queue, callback);
    this.patterns.push(wq);
    return this;
};
/**
 * Builds a new subscription via the publish/subscribe pattern on the current service.
 *
 * @param exchange
 * @param callback
 * @returns {Patterns}
 */
Patterns.prototype.pubSub = function (exchange, callback) {
    exchange = this.namespace + '.' + exchange;
    var ps = new PubSub(exchange, callback);
    this.patterns.push(ps);
    return {
        then: function (callback) {
            return ps.then(function (results) {
                callback(results);
            })
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
Patterns.prototype.routed = function (exchange, routes, callback) {
    exchange = this.namespace + '.' + exchange;
    var routed = new Routed(exchange, routes, callback);
    this.patterns.push(routed);
    return this;
};
/**
 * Builds a new topic based exchange on the current service.
 *
 * @param exchange
 * @param topics
 * @param callback
 * @returns {Patterns}
 */
Patterns.prototype.topic = function (exchange, topics, callback) {
    exchange = this.namespace + '.' + exchange;
    var topic = new Topic(exchange, topics, callback);
    this.patterns.push(topic);
    return this;
};
/**
 * Builds a new RPC queue on the current service.  RPC allows services to return data to the client.
 * @param queue
 * @param callback
 * @returns {Patterns}
 */
Patterns.prototype.rpc = function (queue, callback) {
    queue = this.namespace + '.rpc.' + queue;
    var rpc = new RPC(queue, callback);
    this.rpc_calls.push(rpc);
    return this;
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
    queue = this.namespace + '.' + queue;
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
    exchange = this.namespace + '.' + exchange;
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
}

Patterns.prototype.createChannel = function (conn, rpc_string) {
    var deferred = Q.defer()
      , _this = this;
    conn.createChannel(function (err, channel) {
        if (err) return deferred.reject(err);
        deferred.resolve([channel, conn]);
    });
    return deferred.promise;
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