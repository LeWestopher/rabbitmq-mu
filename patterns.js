/**
 * Created by westopher on 9/22/15.
 */
var amqp = require('amqplib/callback_api');
/**
 * Constructor for a work queue pattern
 *
 * @param queue
 * @param callback
 * @constructor
 */
function WorkQueue (queue, callback) {
    this.queue = queue;
    this.callback = callback || function (){};
}
/**
 * Execution function for WorkQueue constructor
 *
 * @param conn
 */
WorkQueue.prototype.execute = function (conn) {
    var _this = this;
    conn.createChannel(function (err, channel) {

        channel.assertQueue(_this.queue, {durable: true});
        channel.prefetch(1);

        channel.consume(_this.queue, function (msg) {
            var input = parseJson(msg.content.toString());
            _this.callback(input);
        });

    });
};
/**
 * Constructor for subscription side of publish/subscribe pattern
 *
 * @param exchange
 * @param callback
 * @constructor
 */
function PubSub (exchange, callback) {
    this.exchange = exchange;
    this.callback = callback || function(){};
}
/**
 * Execution function for PubSub constructor
 *
 * @param conn
 */
PubSub.prototype.execute = function (conn) {
    var _this = this;
    conn.createChannel(function (err, channel) {

        channel.assertExchange(_this.exchange, 'fanout', {durable: false});

        channel.assertQueue('', {exclusive: true}, function (error, q) {
            channel.bindQueue(q.queue, _this.exchange, '');

            channel.consume(q.queue, function (msg) {
                var input = parseJson(msg.content.toString());
                _this.callback(input);
            })
        })

    })
};
/**
 * Constructor function for a routed exchange pattern
 *
 * @param exchange
 * @param routes
 * @param callback
 * @constructor
 */
function Routed (exchange, routes, callback) {
    this.exchange = exchange;
    this.routes = routes;
    this.callback = callback || function(){};
}
/**
 * Execution function for Routed exchange constructor
 *
 * @param conn
 */
Routed.prototype.execute = function (conn) {
    var _this = this;
    conn.createChannel(function (err, channel) {

        channel.assertExchange(_this.exchange, 'direct', {durable: false});

        channel.assertQueue('', {exclusive: true}, function (err, q) {

            if (typeof _this.routes === 'string') {
                channel.bindQueue(q.queue, _this.exchange, _this.routes);
            } else if (typeof _this.routes === 'array') {
                _this.routes.forEach(function (route) {
                    channel.bindQueue(q.queue, _this.exchange, route);
                })
            }

            channel.consume(q.queue, function (msg) {
                var input = parseJson(msg.content.toString());
                _this.callback(input);
            });
        });
    });
};
/**
 * Constructor for topic based exchange
 *
 * @param exchange
 * @param topics
 * @param callback
 * @constructor
 */
function Topic (exchange, topics, callback) {
    this.exchange = exchange;
    this.topics = topics;
    this.callback = callback || function(){};
}
/**
 * Execution function for topic based exchange
 *
 * @param conn
 */
Topic.prototype.execute = function (conn) {
    var _this = this;
    conn.createChannel(function (err, channel) {

        channel.assertExchange(_this.exchange, 'topic', {durable: false});

        channel.assertQueue('', {exclusive: true}, function (err, q) {

            if (typeof _this.topics === 'string') {
                channel.bindQueue(q.queue, _this.exchange, _this.topics);
            } else if (typeof _this.topics === 'array') {
                _this.topics.forEach(function (topic) {
                    channel.bindQueue(q.queue, _this.exchange, topic);
                })
            }

            channel.consume(q.queue, function (msg) {
                var input = parseJson(msg.content.toString());
                _this.callback(input);
            });
        });
    });
};
/**
 * Constructor for RPC based pattern
 *
 * @param queue
 * @param callback
 * @constructor
 */
function RPC (queue, callback) {
    this.queue = queue;
    this.callback = callback || function (){};
}
/**
 * Execution function for RPC constructor
 *
 * @param conn
 */
RPC.prototype.execute = function (conn) {
    var _this = this;
    conn.createChannel(function (err, channel) {

        channel.assertQueue(_this.queue, {durable: false});
        channel.prefetch(1);

        channel.consume(_this.queue, function reply (msg) {
            var input = parseJson(msg.content.toString());
            var result = _this.callback(input);

            channel.sendToQueue(
                msg.properties.replyTo,
                new Buffer(stringifyJson(result)),
                {correlationId: msg.properties.correlationId}
            );

            channel.ack(msg);
        });
    });
};
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
    return this;
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
Patterns.prototype.init = function (callback) {
    var _this = this;
    amqp.connect('amqp://localhost', function (err, conn) {
        _this.patterns.forEach(function (pattern) {
            pattern.execute(conn);
        });

        _this.rpc_calls.forEach(function (rpc) {
            rpc.execute(conn);
        });

        callback();
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
    amqp.connect('amqp://localhost', function (err, conn) {
        conn.createChannel(function (err, channel) {

            var input = JSON.stringify(args);
            channel.assertQueue(queue, {durable: true});
            channel.sendToQueue(queue, new Buffer(input), {persistent: true});
            conn.close();
        })
    })
};
/**
 * Publish data to a particular queue
 *
 * @param exchange
 * @param args
 */
Patterns.prototype.publish = function (exchange, args) {
    exchange = this.namespace + '.' + exchange;
    amqp.connect('amqp://localhost', function (err, conn) {
        conn.createChannel(function (err, channel) {

            var input = JSON.stringify(args);
            channel.assertExchange(exchange, 'fanout', {durable: false});
            channel.publish(exchange, '', new Buffer(input));
            conn.close();
        })
    })
};
/**
 * Call and RPC method for a foreign module
 *
 * @param rpc_string
 * @param args
 * @param callback
 */
Patterns.prototype.callRpc = function (rpc_string, args, callback) {
    rpc_string = this.namespace + '.rpc.' + rpc_string;
    amqp.connect('amqp://localhost', function(err, conn) {
        conn.createChannel(function(err, ch) {
            ch.assertQueue('', {exclusive: true}, function(err, q) {
                console.log('Queue asserted.');
                console.log(rpc_string);
                var corr = generateUuid();
                var input = stringifyJson(args);

                ch.consume(q.queue, function(msg) {
                    console.log('Channel consumed.');
                    if (msg.properties.correlationId == corr) {
                        console.log(msg.content.toString());
                        var output = parseJson(msg.content.toString());
                        callback(output);
                        conn.close();
                    }
                }, {noAck: true});

                ch.sendToQueue(
                    rpc_string,
                    new Buffer(input),
                    { correlationId: corr, replyTo: q.queue }
                );
            });


        });
    });
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