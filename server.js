// DEBUG
// Set something like 'connect:cookieSession'
process.env.DEBUG     = '';
Error.stackTraceLimit = Infinity;

// SETTINGS
SESSION_MAX_AGE = 1000 * 60 * 60 * 24;
CACHE_TTL       = 1000 * 60 * 10;

var request = require('request');
var connect = require('connect');
var utils   = require('./utils');
var redis   = require('redis');
var fs      = require('fs');
var qs      = require('qs');
var _       = require('underscore');

function redis_connect(){
  global.db      = redis.createClient();
  global.db.on('error', function(err){
    process.stderr.write(err.message + "\n");
    setTimeout(redis_connect, 5000);
  });
}
redis_connect();


// This is the main Connect app for handling boilerplate
var app = connect();

// Serve static before the cookie/form parsers
app.use('/static', connect.static(__dirname + "/static", { 
  maxAge: 365 * 24 * 60 * 60 * 1000
}));

// Static 404 Sentinel
app.use('/static', function(req, res, next){
  res.writeHead(400, "Not Found");
  res.end("Not Found");
});

// Serve static before the cookie/form parsers
app.use('/bower_components', connect.static(__dirname + "/bower_components", { 
  maxAge: 365 * 24 * 60 * 60 * 1000
}));

// Static 404 Sentinel
app.use('/bower_components', function(req, res, next){
  res.writeHead(400, "Not Found");
  res.end("Not Found");
});

app.use('/', connect.cookieParser());
app.use('/', connect.json({ limit: '100kb' }));
app.use('/', connect.urlencoded({ limit: '100kb' }));
app.use('/', connect.cookieSession({ secret: "kirintormageslikesecrets", cookie: { maxAge: SESSION_MAX_AGE } }));


// This runs for each request.
// It establishes the user session and passes it on to the next layers.
app.use('/', function(req, res, next){
  db.get('sess:' + req.session.uid, function(err, user){
    if(err){ return next(err); }

    // No cookie: this is first time visit. Generate a new cookie.
    if( !user ) {
      req.session.uid = utils.guid();
      // User default settings
      req.user = { widgets: [], columns: 3 };
      next();
    }
    
    // Anonymous user
    else if( user.indexOf('anonymous:') === 0 ){
      req.user = JSON.parse( user.substr(10) );
      next();
    }

    // Registered user - get his data from the database
    else if( user.indexOf('user:') === 0 ){
      db.get('user:' + user.substr(5), function(err, user){
        if(err){ return next(err); }

        req.user = JSON.parse(user);
        next();
      });
    }

    // Data screwed up
    else {
      next(new Error("Invalid user session data for cookie '" + req.session.uid + "'"));
    }
  });
});



// This layer will respond to requests to /signout
// Signs out the user by deleting the session.
app.use("/signout", function(req, res, next){
  req.user = { widgets: [] };
  db.del("sess:" + req.session.uid, function(){
    res.body = { status: "ok" };
    next();
  });
});



// This layer will respond to requests to /signin
// It will try to fetch a user from the database and compare its password against the supplied one.
app.use('/signin', function(req, res, next){
  db.get('user:' + req.body.email, function(err, user){
    if(err){ return next(err); }

    user = user && JSON.parse(user);

    if(!user || !utils.comparePasswords(req.body.password, user.password)) {
      res.body = { status: "error", statusCode: 401, message: "Email/Password combination does not exist" };
    }
    else {
      req.user = user;
      res.body = { status: "ok", user: _.clone(req.user) };

      // Never send passwords out
      delete res.body.user.password;
    }
    next();
  });
});



// This layer will respond to requests to /register and will 
// register a new user if an email and password is provided
app.use("/register", function(req, res, next){
  // TODO: Do not allow re-registering of the same email

  // To register a user we simply need to set the email and password
  // to the anonymous session object. The middleware layer that saves the session
  // will push this to the database therefore creating a new user account.
  if(req.body.email && req.body.password) {
    req.user.password = utils.hashPassword(req.body.password);
    req.user.email = req.body.email;
    res.body = { status: 'ok', user: _.clone(req.user) };

    // Never send passwords out
    delete res.body.user.password;
  }
  else {
    res.body = { status: 'error', statusCode: 400, message: 'Email or Password missing' };
  }

  next();
});



// This layer will respond to requests made to /remove_widget and will
// remove a widget with the specific id from the user configuration
app.use('/remove_widget', function(req, res, next){
  var id = parseInt(req.body.id, 10);
  req.user.widgets = req.user.widgets.filter(function(w){ return w.id !== id });
  res.body = { status: "ok" }
  next();
});



// This layer will respond to requests to /state.js and send a javascript file
// that will set global variables which describe the application state
app.use('/state.js', function(req, res, next){
  res.writeHead(200, "OK", { "Content-Type": "application/javascript" });

  // Never send passwords out
  var user = _.clone(req.user);
  delete user.password;

  res.end("MODULES=" + JSON.stringify(_.keys(modules)) + ";USER=" + JSON.stringify(user) + ";" );
});


// Widget management function
app.use('/widget', function(req, res, next){  
  var config = req.body;
  var id = parseInt(config.id);

  // Check if the widget already exists
  var widgets  = req.user.widgets;
  var exists   = id && _.find(widgets, function(w){ return id === w.id; });
  var position = config.position;

  delete config.position;
  if(exists) {
    // When the position key is sent, we want to reorder the widgets around
    // so that the widget keeps its position respective to the other widgets in the same column.
    if(position !== undefined) {
      var widget, i, widgetsBefore = 0;

      for(i = 0; i < req.user.widgets.length; ++i){
        widget = req.user.widgets[i];

        if(widget.column !== exists.column) {
          continue;
        }
        else if(widget === exists) {
          break;
        }
        widgetsBefore += 1;

        if(widgetsBefore > position) {
          req.user.widgets.splice(req.user.widgets.indexOf(exists), 1);
          req.user.widgets.splice(i, 0, exists);
          break;
        }
      }
    }

    _.extend(exists, config);    
  }
  else {
    id = config.id = (widgets.length && _.max(_.pluck(widgets, 'id'))) + 1;
    req.user.widgets.push(config);
  }
  
  // Set the response body
  res.body = { status: 'ok', id: id };
  next();
});



/**
 * This handler is used by the frontend to proxy requests to other sites.
 * It works in 2 ways:
 *   1. A POST request with a "source=http://example.com/page.html" in its body will
 *      fetch the page and return its body as text.
 *   2. A GET request with a source=http://example.com/resource.ext in the querystring will
 *      fetch the resource and proxy it as binary data. Useful for caching images.
 *
 * Both modes will cache the resource in Redis for 10 minutes.
**/
app.use('/proxy', function(req, res, next){
  if(req.method === 'POST') {
    var source = req.body.source;
    var binary = false;
  }
  else if(req.method === 'GET') {
    var parsed = qs.parse(req._parsedUrl.query);
    var source = parsed.source;
    var binary = true;
  }

  if(!source) {
    res.body = { status: 'error', message: 'Invalid Link' };
    return next();
  }

  // TODO: Better sanitization
  if(source.substr(0, 7) != "http://" && source.substr(0, 8) != "https://"){
    source = "http://" + source;
  }

  db.get(( binary ? 'cache-binary:' : 'cache:') + source, function(err, result){
    if(err){ return next(err); }

    // Result found in cache
    if(result){
      
      if(binary) {
        var result = result.split("\n\n");
        res.writeHead(200, "OK", JSON.parse(result[0]));
        result = new Buffer(result[1], 'base64');
      }
      return res.end(result);

    }
    
    request({ url: source, encoding: binary ? null : undefined }, function(err, response, body){
      if(err) {
        res.body = { statusCode: 500, status: 'error', message: 'Request Error (' + err.code + ')' };
        return next();
      }
      if(response.statusCode !== 200) {
        res.body = { statusCode: 504, status: 'error', message: 'Server Error (' + response.statusCode + ')' };
        return next();
      }

      if(binary){
        db.set('cache-binary:' + source, JSON.stringify(response.headers) + "\n\n" + body.toString('base64'));
        db.pexpire('cache-binary:' + source, CACHE_TTL);
        res.writeHead(200, "OK", response.headers);
        return res.end(body);
      }
      
      // We expire the key after CACHE_TTL time, which is 10 minutes by default.
      // Redis will automatically delete the key and when it's next looked up, 
      // we're gonna need to fetch it again.
      db.set('cache:' + source, body);
      db.pexpire('cache:' + source, CACHE_TTL);
      res.end(body);
    });

  });
});


// Save user and sessions
app.use('/', function(req, res, next){
  // Registered users keep their data in the user: key
  // Anonymous users keep all their data in the session: key
  if(req.user.email) {
    db.set('user:' + req.user.email, JSON.stringify(req.user));
    db.set('sess:' + req.session.uid, 'user:' + req.user.email);
  }
  else {
    db.set('sess:' + req.session.uid, 'anonymous:' + JSON.stringify(req.user));
  }

  // Touch the session.
  // We want a new cookie on each request so that the user session is remembered
  // unless he doesn't visit the site for "maxAge" time.
  req.session.expires = new Date + SESSION_MAX_AGE;
  // We also need to touch the sess: key to extend it's expiry date.
  db.pexpire('sess:' + req.session.uid, SESSION_MAX_AGE);  
  next();  
});



// This layer will catch all requests where 'res.body' has been set to something meaningful.
// Objects and arrays will be serialized to JSON. Strings will be rendered as txt/html.
app.use('/', function(req, res, next){
  if(typeof res.body === 'string') {
    res.writeHead(200, "OK");
    res.end(res.body);
  }
  else if(_.isObject(res.body) && res.body.status === 'error'){
    res.writeHead(res.body.statusCode || 500, res.body.message || "Server Error");
    res.end();
  }
  else if(_.isObject(res.body) || _.isArray(res.body)){
    res.writeHead(200, "OK", { 'Content-Type': 'applicaiton/json' });
    res.end(JSON.stringify(res.body));
  }
  else {
    next();
  }
});


// 404 Sentinel
// Requests that made it here without explicitly requesting "/"
// are requests that didn't match any other middleware layer, therefore 404 errors
app.use('/', function(req, res, next){
  if( req.url !== '/' ) {
    res.writeHead(404, "Not Found");
    res.end("Not Found");
  }
  else {
    next();
  }
});


// Render index.html
app.use('/', function(req, res, next){
  // TODO: Pipe the file to the response
  fs.readFile("index.html", function(err, html){
    res.writeHead(200, "OK");
    res.end(html);
  });
});



app.listen(3001);
console.log("Server running on port 3001");
