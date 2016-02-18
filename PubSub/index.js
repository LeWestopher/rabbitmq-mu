var Q = require('q')
  , _ = require('underscore');

var defaults = {
    durable: false,
    exclusive: true,
    exchange_type: 'fanout',
    onCreateChannel: function (channel) { return channel; },
    onExchangeAndQueue: function (q, channel) { return [q, channel]; },
    onBindAndConsume: function (msg) { return msg; }
};

/**
 * Constructor for subscription side of publish/subscribe pattern
 *
 * @param exchange
 * @param config
 * @constructor
 */
function PubSub (exchange, config) {
    this.exchange = exchange;
    this.config = _.defaults(defaults, config);
}
/**
 * Returns a promise object for asynchronously creating a channel with RabbitMQ
 *
 * @returns Promise
 */
PubSub.prototype.createChannel = function () {
    var deferred = Q.defer()
      , _this = this;

    this.conn.createChannel(function (err, channel) {
        if (err) {
            deferred.reject(err);
        }
        // Transform our channel object
        channel = _this.config.onCreateChannel(channel);
        _this.channel = channel;
        deferred.resolve(channel)
    });

    return deferred.promise;
};
/**
 * Returns a promise object for asynchronously asserting an exchange and asserting a queue on our channel object.
 *
 * @param channel
 * @returns Promise
 */
PubSub.prototype.assertExchangeAndQueue = function (channel) {
    var deferred = Q.defer()
      , _this = this;

    channel.assertExchange(this.exchange, this.config.exchange_type, {durable: this.config.durable});
    channel.assertQueue('', {exclusive: this.config.exclusive}, function (err, q) {
        if (err) {
            return deferred.reject(err);
        }
        _this.q = q;
        // Transform our queue and channel objects
        var resolve = _this.config.onExchangeAndQueue(q, channel);
        deferred.resolve(resolve);
    });

    return deferred.promise;
};
/**
 * Returns a promise object for asynchronously binding a queue and consuming the resulting message on the channel object.
 *
 * @param q
 * @param channel
 * @returns {*}
 */
PubSub.prototype.bindQueueAndConsume = function (q, channel) {
    var deferred = Q.defer()
      , _this = this;

    channel.bindQueue(q.queue, this.exchange, '');
    channel.consume(q.queue, function (msg) {
        msg = _this.config.onBindAndConsume(msg);
        deferred.resolve(msg);
    });

    return deferred.promise;
};
/**
 * Initializer function for consuming our message object
 *
 * Returns a promise that resolves the message object for consumption from the PubSub queue.
 *
 * @param conn
 * @returns {*}
 */
PubSub.prototype.consume = function (conn) {
    this.conn = conn;
    return this
        .createChannel()
        .then(this.assertExchangeAndQueue)
        .spread(this.bindQueueAndConsume);
};