// DEBUG
// Set something like 'connect:cookieSession'
process.env.DEBUG     = '';
Error.stackTraceLimit = Infinity;

// SETTINGS
SESSION_MAX_AGE       = 1000 * 60 * 60 * 24;

var connect = require('connect');
var redis   = require('redis');
var fs      = require('fs');
var _       = require('underscore');

global.db      = redis.createClient();
global.modules = { rss: require('./rss') }

// Each module has its own Connect server for  handling module-specific requests.
var moduleProxy = connect();
moduleProxy.use('/rss', modules.rss.app);

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

app.use('/', connect.cookieParser());
app.use('/', connect.urlencoded({ limit: '100kb' }));
app.use('/', connect.cookieSession({ secret: "kirinthormageslikesecrets", cookie: { maxAge: SESSION_MAX_AGE } }));

// Get user and sessions
app.use('/', function(req, res, next){
  db.get('sess:' + req.session.uid, function(err, user){
    if(err){ return next(err); }

    // No cookie: this is first time visit. Generate a new cookie.
    if( !user ) {
      req.session.uid = guid();
      req.user = { widgets:[] };
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

// This layer will respond to requests to /state.js and send a javascript file
// that will set global variables which describe the application state
app.use('/state.js', function(req, res, next){
  res.writeHead(200, "OK", { "Content-Type": "application/javascript" });
  res.end("MODULES=" + JSON.stringify(_.keys(modules)) + ";USER=" + JSON.stringify(req.user) + ";" );
});

// Proxy to modules
app.use('/module', moduleProxy);

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
// Requests that get to here without explicitly requesting "/"
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
  fs.readFile("index.html", function(err, html){
    res.writeHead(200, "OK");
    res.end(html);
  });
});

app.listen(3001);
console.log("Server running on port 3001");







/**
 * Helpers
**/

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
};
function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
