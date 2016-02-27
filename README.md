# Mu.js
### An elegant solution to building RabbitMQ-based Node.js microservices

This respository is currently under construction due to the conversion from a callback based architecture to a promise based
architecture, but you are still welcome to peruse some of the code that is available to view.  Here are some (untested and potentially explosive) examples:

## Getting a connection object

To get a connection object, we use the `.connect()` method:

```javascript

var rabbitmq = require('./patterns');

rabbitmq('your-namespace')
    .connect()
    .then(function (connection) {
        // Use your connection object here!
    });
```

## Building your first Work Queue

Work queues are some of the most basic types of microservices that can be extended using Mu to offset processing time
of various actions off of your request/response.  The sending of emails, large file parsing, and other computational
expensive actions can be created within your work queue and then delegated to from your main application.  Here is an
example of a potential email sender:

```javascript

var rabbitmq = require('./patterns');
var PubSub = require('./PubSub/index');

rabbitmq('your-namespace')
    .workQueue('email-sender')
    // Your queue string maps out to 'your-namespace.email-sender'
    .then(function (message) {
        var email_object = message.content.toJson();
        var email = new Email(email_object.address, email_object.subject, email_object.body);
        return email.send();
    });
```

## Manually building a Publish/Subscribe exchange

First we must get our connection object, and then build a new PubSub object with it as the first argument:

```javascript

var rabbitmq = require('./patterns');
var PubSub = require('./PubSub/index');

rabbitmq('your-namespace')
    .connect()
    .then(function (connection) {
        var microservice = new PubSub('your-pubsub-namespace');
        // This returns a promise which contains the message object which can then be handled
        return microservice.consume(connection);
    }
    .then(function (message) {
        // Consume the message on publish here
        console.log('[MESSAGE RECEIVED] ' + message.content.toString());
    });

```

## Manually building a Topic-based exchange

Again, we get our connection object, then build a Topic based exchange object

```javascript

var rabbitmq = require('./patterns');
var Topic = require('./Topic/index');

rabbitmq('your-namespace')
    .connect()
    .then(function (connection) {
        // This exchange will only subscribe to 'your-pubsub-namepsace', with 'topicA', 'topicB', and 'TopicC'
        var microservice = new Topic('your-pubsub-namespace', ['topicA', 'topicB', 'topicC']);
        // This returns a promise which contains the message object which can then be handled
        return microservice.consume(connection);
    })
    .then(function (message) {
        // Consume the message on publish here
        console.log('[MESSAGE RECEIVED] ' + message.content.toString());
    });
```

## Roadmap

- [ ] Full Documentation for all subscription types
- [ ] Uploaded to NPM for inclusion via package manager
- [ ] ~Better design for how multiple microservice daemons are built on a single RabbitMQ namespace~ (Better solution found)
- [ ] Inclusion of the message topic in the returned arguments for a Topic-based exchange
- [X] Configurable connection input for RabbitMQ.  Currently is set to the typical localhost connection
- [ ] Full testing utilizing Jasmine

## Docs Roadmap

- [X] Connection Docs
- [ ] Connection with configuration docs
- [X] Shorthand Work Queue Docs
- [ ] Shorthand PubSub Docs
- [ ] Shorthand Routed Docs
- [ ] Shorthand Topic Docs
- [ ] Shorthand RPC Docs
- [ ] Manual Work Queue Docs
- [X] Manual PubSub Docs
- [ ] Manual Routed Docs
- [ ] Manual Topic Docs
- [ ] Manual RPC Docs
- [ ] Broadcasting Docs
- [ ] Publishing Docs
- [ ] Calling RPC Method Docs


## License

Copyright 2015–2016 Quinton Wesley King and contributors MIT License