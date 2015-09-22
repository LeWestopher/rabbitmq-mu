/**
 * Created by westopher on 9/22/15.
 */
var amqp = require('amqplib/callback_api');

function WorkQueue (queue, callback) {
    this.queue = queue;
    this.callback = callback || function (){};
}

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

function PubSub (exchange, callback) {
    this.exchange = exchange;
    this.callback = callback || function(){};
}

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

function Routed (exchange, routes, callback) {
    this.exchange = exchange;
    this.routes = routes;
    this.callback = callback || function(){};
}

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

function Topic (exchange, topics, callback) {
    this.exchange = exchange;
    this.topics = topics;
    this.callback = callback || function(){};
}

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

function RPC (queue, callback) {
    this.queue = queue;
    this.callback = callback || function (){};
}

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

function Patterns (namespace) {
    this.namespace(namespace);
    this.patterns = [];
    this.rpc_calls = [];
}

Patterns.prototype.namespace = function (namespace) {
    this.namespace = namespace;
    return this;
};

Patterns.prototype.workQueue = function (queue, callback) {
    queue = this.namespace + '.' + queue;
    var wq = new WorkQueue(queue, callback);
    this.patterns.push(wq);
    return this;
};

Patterns.prototype.pubSub = function (exchange, callback) {
    exchange = this.namespace + '.' + exchange;
    var ps = new PubSub(exchange, callback);
    this.patterns.push(ps);
    return this;
};

Patterns.prototype.routed = function (exchange, routes, callback) {
    exchange = this.namespace + '.' + exchange;
    var routed = new Routed(exchange, routes, callback);
    this.patterns.push(routed);
    return this;
};

Patterns.prototype.topic = function (exchange, topics, callback) {
    exchange = this.namespace + '.' + exchange;
    var topic = new Topic(exchange, topics, callback);
    this.patterns.push(topic);
    return this;
};

Patterns.prototype.rpc = function (queue, callback) {
    queue = this.namespace + '.rpc.' + queue;
    var rpc = new RPC(queue, callback);
    this.rpc_calls.push(rpc);
    return this;
};

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


module.exports = function (namespace) {
    return new Patterns(namespace);
};

function parseJson (string) {
    try {
        var json_obj = JSON.parse(string);
        return json_obj;
    } catch (e) {
        return {};
    }
}

function stringifyJson (object) {
    try {
        var json_string = JSON.stringify(object);
        return json_string;
    } catch (e) {
        return JSON.stringify({});
    }
}

function generateUuid() {
    return Math.random().toString() +
        Math.random().toString() +
        Math.random().toString();
}