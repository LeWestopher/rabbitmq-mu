## Branch

The new branch of the project devoted to development with Kyle Rebstock and Wes kill shall be called `next-master`.

## Tabs

2 space indent, no tabs.  

## Variable Notation

Variables should be notated with Airbnb's next line comma notation:

```js
var first = 1
  , second = 2
  , third = 3
  , fourth = 'four';
```

## General Styling

This code shall follow the [Airbnb JavaScript style guide](https://github.com/airbnb/javascript).

## Invoking the module

Invoking the module itself as a function will return an object that can be broadcast on to publish messages to RabbitMQ exchanges and pub/subs that you have defined elsewhere.

```js
var mu = require('rabbitmq-mu');

mu('subscriber.namespace.addressed.to').broadcast({id: 1, user: 'Westopher', action: 'saved_user'});
```

## Extending Subscriber Application Classes

Some examples of how we will define how an application that SUBSCRIBES to RabbitMQ are created:

```js
// Get the base WorkQueue class from our module
var WorkQueue = require('rabbitmq-mu').WorkQueue;
// Extend our own custom work queue in the specified namespace to subscribe to events on
var custom_workqueue_class = WorkQueue.extend({
  namespace: 'email-sender',
  daemon: function (msg) {
    // msg is the message that gets published that this current class we are building 'subscribes' to.
    var email = new Email(msg.to, msg.from, msg.subject, msg.body);
    email.send();
  }
});
// Create a new instance of our custom class
var istantiated_workqueue = new CustomWorkQueueClass();
// Initialize the app to listen on the specified namespace for messages.
instantiated_workqueue.init();

// Broadcast based on a specific object built previously:
var secondary_queue = new CustomWorkQueueClass();
secondary_queue.broadcast({
  to: 'kyle@kjr.com', 
  from: 'wes@westopher.com', 
  subject: 'Welcome!', 
  body: 'This is the email body!'
});

// Other objects can  be instantianted...
var PubSub = requre('rabbitmq-mu').PubSub;
var RoutedExchange = require('rabbitmq-mu').RoutedExchange;
// And more...
```

## The Trick We Use to Make This Happen

A little known fact in JavaScript is that you can actually define properties on functions.  Watch:

```js
// Run this in your Web Inspector
function getName() {
    return 'Kyle Rebstock');
}

getName.help = 'getName() Help: This function returns your name!';

console.log(getName());
// Prints 'Kyle Rebstock';
console.log(getName.help);
// Prints 'getName() Help: This function returns your name!'
```
```
