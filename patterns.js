/**
 * Mu.js - An elegant solution to creating Node.js microservices with RabbitMQ
 *
 * Created by Wes King on 9/22/15.
 *
 * MIT Licensed
 */
(function () {
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
     * Import our dependencies
     *
     * Underscore.js
     * Q.js
     * The AMQP Callback API
     */
    var amqp        = require('amqplib/callback_api')
        , Q           = require('q')
        , _           = require('underscore')
        , PubSub      = require('./PubSub')
        , Routed      = require('./Routed')
        , RPC         = require('./RPC')
        , Topic       = require('./Topic')
        , WorkQueue   = require('./WorkQueue');
    /**
     * Set our default settings
     *
     * @type {{host: string, namespace_divider: string}}
     */
    var defaults = {
        host: 'amqp://localhost',
        namespace_divider: '.'
    };
    /**
     * Main service pattern constructor
     *
     * @param namespace - {string} - A custom namespace for the current daemon you are building
     * @param config  - {object} - A list of configuration values for the application
     * @constructor
     */
    function Patterns (namespace, config) {
        this.namespace(namespace)
            .configuration(config);
        this.patterns = [];
        this.rpc_calls = [];
    }
    /**
     * Sets the current namespace of the service being declared
     *
     * @param namespace - {string} - A custom namespace for the current daemon you are building
     * @returns {Patterns}
     */
    Patterns.prototype.namespace = function (namespace) {
        this.namespace = namespace;
        return this;
    };
    /**
     * Builds out the configuration object for connecting to the RabbitMQ server
     *
     * @param config - {object} - A list of configuration values for the application
     * @returns {Patterns}
     */
    Patterns.prototype.configuration = function (config) {
        this.config = _.defaults(config, defaults);
        return this;
    };
    /**
     * Builds a new worker queue on the current service
     *
     * @param queue - {string} - The namespace extension for the current work queue.  Eg - it would end up being namespace.queue.
     * @returns {Patterns}
     */
    Patterns.prototype.workQueue = function (queue) {
        var _this = this;
        queue = this.getQueueString(queue);
        return this.connect()
            .then(function (connection) {
                var wq = new WorkQueue(queue);
                _this.patterns.push(wq);
                return wq.consume(connection);
            });
    };
    /**
     * Builds a new subscription via the publish/subscribe pattern on the current service.
     *
     * @param exchange - {string} - The namespace extension for the current PubSub queue.  Eg - it would end up being namespace.exchange.
     * @returns {Patterns}
     */
    Patterns.prototype.pubSub = function (exchange) {
        var _this = this;
        exchange = this.getExchangeString(exchange);
        return this.connect()
            .then(function (connection) {
                var ps = new PubSub(exchange);
                _this.patterns.push(ps);
                return ps.consume(connection);
            });
    };
    /**
     * Builds a new routed exchange pattern on the current service
     *
     * @param exchange - {string} - The namespace extension for the current Routed queue.
     * @param routes - {array} - A list of routes for the daemon being defined to consume on the current namespace
     * @returns {Patterns}
     */
    Patterns.prototype.routed = function (exchange, routes) {
        var _this = this;
        exchange = this.getExchangeString(exchange);
        return this.connect()
            .then(function (connection) {
                var routed = new Routed(exchange, routes);
                _this.patterns.push(routed);
                return routed.consume(connection);
            });
    };
    /**
     * Builds a new topic based exchange on the current service.
     *
     * @param exchange - {string} - The namespace extension for the current Topic based queue.
     * @param topics - {array} - A list of topics for the daemon being define to subscribe to on the current namespace.
     * @returns {Patterns}
     */
    Patterns.prototype.topic = function (exchange, topics) {
        var _this = this;
        exchange = this.getExchangeString(exchange);
        return this.connect()
            .then(function (connection) {
                var topic = new Topic(exchange, topics);
                _this.patterns.push(topic);
                return topic.consume(connection);
            });
    };
    /**
     * Builds a new RPC queue on the current service.  RPC allows services to return data to the client.
     * @param queue - {string} - the namespace extension for the current RPC method.  Would look like `namespace.rpc.queue`
     * @returns {Patterns}
     */
    Patterns.prototype.rpc = function (queue) {
        var _this = this;
        queue = this.getRpcString(queue);
        return this.connect()
            .then(function (connection) {
                var rpc = new RPC(queue);
                _this.rpc_calls.push(rpc);
                return rpc.consume(connection);
            });
    };
    /**
     * Broadcast data to a particular queue
     *
     * @param queue - {string} - The namespaced extension of the queue you are attempting to broadcast to
     * @param args - {*} - Takes an input consisting of arguments relevant to the RPC method being called.
     * @returns {Promise}
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
            })
            .done();
    };
    /**
     * Publish data to a particular queue
     *
     * @param exchange - {string} - The namespaced extension of the PubSub you are attempting to publish to
     * @param args - {*} - Takes an input consisting of the arguments being published to the queue.
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
    /**
     * Calls and RPC method to a queue with the given method name along with the arguments to pass into the method
     *
     * @param rpc_string - {string} - The RPC method that you are attempting to call from the RabbitMQ service
     * @param args - {*} - Takes an input consisting of the arguments being published to the queue.
     * @returns {Promise}
     */
    Patterns.prototype.callRpc = function (rpc_string, args) {
        rpc_string = this.namespace + '.rpc.' + rpc_string;
        return this
            .rpcConnect(rpc_string, args)
            .spread(this.createRpcChannel)
            .spread(this.assertRpcQueue)
    };
    /**
     * Asserts and RPC queue via chained spread arguments for consumption of an RPC method
     *
     * @param channel - {object} - The channel object being passed down the promise chain for consumption by RPC
     * @param connection - {object} - The connection object being passed down the promise chain for consumption by RPC
     * @param rpc_string - {string} - The namespace extended RPC method being called on the daemon
     * @param args - {*} - Takes an input consisting of the arguments being published to the queue.
     * @returns {Promise}
     */
    Patterns.prototype.assertRpcQueue = function (channel, connection, rpc_string, args) {
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
                    connection.close();
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
    /**
     * The basic connect method.  Returns a promise that consumes the connection object for usage.
     *
     * @returns {Promise}
     */
    Patterns.prototype.connect = function () {
        var deferred = Q.defer()
            , _this = this;
        amqp.connect(this.config.host, function (err, connection) {
            if (err) return deferred.reject(err);
            deferred.resolve(connection);
        });
        return deferred.promise;
    };
    /**
     * The basic method of connecting for calling an RPC method.  We have a specialty method for connecting via RPC because
     * we have to continue to chain the rpc_string, args, and connection objects down the promise chain using spread, so this
     * method is a wrapper for that functionality.
     *
     * @returns {Promise}
     */
    Patterns.prototype.rpcConnect = function (rpc_string, args) {
        var deferred = Q.defer();
        amqp.connect(this.config.host, function (err, connection) {
            if (err) return deferred.reject(err);
            deferred.resolve([connection, rpc_string, args]);
        });
        return deferred.promise;
    };
    /**
     * Similiar to the .rpcConnect() method above, this method is a wrapper that continues to chain arguments down the
     * promise chain using the spread method so that an RPC method can be consumed.
     *
     * @param connection - {object} - The connection object being passed down the promise chain for consumption by RPC
     * @param rpc_string - {string} - The namespaced RPC method being passed down the promise chain for consumption by RPC
     * @param args - {*} - Takes an input consisting of the arguments being published to the queue.
     * @returns {Promise}
     */
    Patterns.prototype.createRpcChannel = function (connection, rpc_string, args) {
        var deferred = Q.defer();
        connection.createChannel(function (err, channel) {
            if (err) return deferred.reject(err);
            deferred.resolve([channel, connection, rpc_string, args]);
        });
        return deferred.promise;
    };
    /**
     * The basic method for creating a channel.  Can be chained with the .connect() promise chain to allow for the channel
     * and the connection to be consumed via the .spread() method in the promise chain.
     *
     * @param connection - {object} - The RabbitMQ connection object consumed from the previous .connect() method in promise chain
     * @returns {Promise}
     */
    Patterns.prototype.createChannel = function (connection) {
        var deferred = Q.defer();
        connection.createChannel(function (err, channel) {
            if (err) return deferred.reject(err);
            deferred.resolve([channel, connection]);
        });
        return deferred.promise;
    };
    /**
     * Shorthand method for building out a namespaced queue string for a daemon
     *
     * @param queue - {string} - The designated queue name to be built into a fully namespaced string
     * @returns {string}
     */
    Patterns.prototype.getQueueString = function (queue) {
        return this.namespace + this.config.namespace_divider + queue;
    };
    /**
     * Shorthand method for building out a namespaced exchange string for a daemon
     *
     * @param exchange - {string} - the
     * @returns {string}
     */
    Patterns.prototype.getExchangeString = function (exchange) {
        return this.namespace + this.config.namespace_divider + exchange;
    };
    /**
     * Shorthand method for building out a named spaced RPC method string for a daemon
     *
     * @param rpc
     * @returns {string}
     */
    Patterns.prototype.getRpcString = function (rpc) {
        return this.namespace + this.config.namespace_divider + 'rpc' + this.config.namespace_divider + rpc;
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
}());