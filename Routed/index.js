var Q = require('q')
  , _ = require('underscore');

var defaults = {
    exchange_type: 'direct',
    durable: false,
    exclusive: true
};

/**
 * Constructor function for a routed exchange pattern
 *
 * @param exchange
 * @param routes
 * @param callback
 * @constructor
 */
function Routed (exchange, routes, config) {
    this.exchange = exchange;
    this.routes = routes;
    this.config = _.defaults(defaults, config);
}

Routed.prototype.createChannel = function () {
    var deferred = Q.defer()
        , _this = this;

    this.conn.createChannel(function (err, channel) {
        if (err) {
            return deferred.reject(err);
        }
        deferred.resolve(channel);
    });

    return deferred.promise;
};

Routed.prototype.assertExchangeAndQueue = function (channel) {
    var deferred = Q.defer()
        , _this = this;

    channel.assertExchange(_this.exchange, 'direct', {durable: false});
    channel.assertQueue('', {exclusive: true}, function (err, q) {

        if (err) {
            return deferred.reject(err);
        }

        deferred.resolve([q, channel]);
    });
};

Routed.prototype.bindQueueAndConsume = function (q, channel) {
    var deferred = Q.defer()
        , _this = this;

    if (typeof _this.routes === 'string') {
        channel.bindQueue(q.queue, _this.exchange, _this.routes);
    } else if (typeof _this.routes === 'array') {
        _this.routes.forEach(function (route) {
            channel.bindQueue(q.queue, _this.exchange, route);
        })
    }

    channel.consume(q.queue, function (msg) {
        deferred.resolve(msg);
    });

    return deferred.promise;
};

Routed.prototype.consume = function (conn) {
    this.conn = conn;
    return this
        .createChannel()
        .then(this.assertExchangeAndQueue)
        .then(this.bindQueueAndConsume);
};