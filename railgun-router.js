/**
 * Created by westopher on 9/22/15.
 */
var amqp = require('amqplib/callback_api');
var railgun = require('./railgun');
var _ = require('underscore');

/**
 * Railgun-Router is the primary library used as a worker daemon to process requests.  This daemon can be dispatched
 * en mass to handle large amounts of test at one time and scales well horizontally.
 */
amqp.connect('amqp://localhost', function (err, conn) {
    conn.createChannel(function (err, channel) {

        channel.assertQueue('railgun_queue', {durable: true});
        channel.prefetch(1);

        channel.consume('railgun_queue', function (msg) {

            var test = JSON.parse(msg.content.toString());

            /**
             * Response Object:
             * res = {
             *      readable: '',
             *      domain: '',
             *      socket: '',
             *      connection: '',
             *      httpVersion: '',
             *      complete: '',
             *      headers: '',
             *      trailers: '',
             *      url: '',
             *      method: '',
             *      statusCode: '',
             *      client: '',
             *      httpVersionMajor: '',
             *      httpVersionMinor: '',
             *      upgrade: '',
             *      req: '',
             *      request: '',
             *      toJSON: '',
             *      caseless: '',
             *      pipe: '',
             *      addListener: '',
             *      on: '',
             *      pause: '',
             *      resume: '',
             *      read: '',
             *      body: ''
             * }
             */
            railgun(test)
                .on('ping', function (response) {
                    console.log(response);
                    console.log('Ping was successful!');
                    channel.ack(msg);
                })
                .on('response_integrity', function (response) {
                    console.log(response);
                    console.log('response_integrity was successful!');
                    channel.ack(msg);
                })
                .on('json_response_integrity', function (response) {
                    console.log(response);
                    console.log('json_response_integrity was successful!');
                    channel.ack(msg);
                })
                .on('keyword', function (response) {
                    console.log(_.keys(response));
                    console.log('keyword was successful!');
                    channel.ack(msg);
                })
                .execute();

        }, {noAck: false});

    });
});