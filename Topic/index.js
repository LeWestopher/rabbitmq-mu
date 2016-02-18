/**
 * Constructor for topic based exchange
 *
 * @param exchange
 * @param topics
 * @param callback
 * @constructor
 */
function Topic (exchange, topics) {
    this.exchange = exchange;
    this.topics = topics;
}

Topic.prototype.createChannelAndAssertExchange = function () {
    var deferred = Q.defer()
        , _this = this;

    this.conn.createChannel(function (err, channel) {

        if (err) {
            deferred.reject(err);
        }

        channel.assertExchange(_this.exchange, 'topic', {durable: false});
        deferred.resolve(channel);
    });

    return deferred.promise;
};

Topic.prototype.assertQueueAndConsumeChannel = function (channel) {
    var deferred = Q.defer()
      , _this = this;

    channel.assertQueue('', {exclusive: true}, function (err, q) {

        if (err) {
            return deferred.reject(err);
        }

        if (typeof _this.topics === 'string') {
            channel.bindQueue(q.queue, _this.exchange, _this.topics);
        } else if (typeof _this.topics === 'array') {
            _this.topics.forEach(function (topic) {
                channel.bindQueue(q.queue, _this.exchange, topic);
            })
        }

        channel.consume(q.queue, function (msg) {
            deferred.resolve(msg);
        });
    });

    return deferred.promise;
};

Topic.prototype.consume = function (conn) {
    this.conn = conn;
    return this
        .createChannelAndAssertExchange()
        .then(this.assertQueueAndConsumeChannel);
};

module.exports = Topic;