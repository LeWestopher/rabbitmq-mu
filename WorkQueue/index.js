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

WorkQueue.prototype.createChannel = function () {
    var deferred = Q.defer()
        , _this = this;

    this.conn.createChannel(function (err, channel) {

        if (err) {
            return deferred.reject(err);
        }

        channel.assertQueue(_this.queue, {durable: true});
        channel.prefetch(1);
        channel.consume(_this.queue, function (msg) {
            deferred.resolve(msg);
        });
    });

    return deferred.promise;
};

WorkQueue.prototype.consume = function (conn) {
    this.conn = conn;
    return this.createChannel();
};