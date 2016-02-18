/**
 * Constructor for RPC based pattern
 *
 * @param queue
 * @param callback
 * @constructor
 */
function RPC (queue) {
    this.queue = queue;
}

RPC.prototype.createChannel = function () {
    var deferred = Q.defer()
      , _this = this;

    this.conn.createChannel(function (err, channel) {

        if (err) {
            return deferred.reject(err);
        }

        channel.assertQueue(_this.queue, {durable: false});
        channel.prefetch(1);
        channel.consume(_this.queue, function reply(msg) {

            function respond(returned) {
                channel.sendToQueue(
                    msg.properties.replyTo,
                    new Buffer(returned),
                    {correlationId: msg.properties.correlationId}
                );
                channel.ack(msg);
            }

            deferred.resolve([msg, respond]);
        });

        deferred.resolve(channel);
    });

    return deferred.promise;
};

RPC.prototype.consume = function (conn) {
    this.conn = conn;
    return this.createChannel();
};