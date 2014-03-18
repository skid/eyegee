/**
 * RSS Module
**/
var connect = require('connect');
var request = require('request');
var _ = require('underscore');
var app = connect();

var CACHE_TTL = 1000 * 60 * 10;

/**
 * Adds or modifies an RSS widget.
 * Saves the new settings in the database.
**/
app.use('/widget', function(req, res, next){
  // RSS Widget parameters
  var sources = req.body.sources;
  var title   = req.body.title;
  var count   = req.body.count;
  var id      = parseInt(req.body.id);

  // Check if the widget already exists
  var widgets = req.user.widgets;
  var exists  = id && _.find(widgets, function(w){ return id === w.id; });

  // If exists, update it
  if(exists) {
    exists.count = count;
    exists.sources = sources;
    exists.title = (title || exists.title);
  }

  // If not push make a new one
  else {
    id = (widgets.length && _.max(_.pluck(widgets, 'id'))) + 1;
    req.user.widgets.push({
      id:      id,
      sources: sources,
      title:   title,
      count:   count,
      module:  'rss'
    });
  }

  // Set the response body
  res.body = { status: 'ok', id: id };
  next();
});

/** 
 * Fetches a feed from its source, or retrieves it from the cache
**/
app.use('/feed', function(req, res, next){
  var source = req.body.source;
  
  if(!source) {
    res.body = { status: 'error', message: 'Invalid RSS link' };
    return next();
  }

  // TODO: Better sanitization
  if(source.substr(0, 7) != "http://" && source.substr(0, 8) != "https://"){
    source = "http://" + source;
  }

  db.get('rss:' + source, function(err, result){
    if(err){ return next(err); }
    
    // Result found in cache
    if(result){
      return res.end(result);
    }

    request(source, function(err, response, body){
      if(err) {
        res.body = { statusCode: 500, status: 'error', message: 'Feed Request Error (' + err.code + ')' };
        return next();
      }
      if(response.statusCode !== 200) {
        res.body = { statusCode: 504, status: 'error', message: 'Feed Server Error (' + response.statusCode + ')' };
        return next();
      }
      
      // We expire the key after CACHE_TTL time, which is 10 minutes by default.
      // Redis will automatically delete the key and when it's next looked up, 
      // we're gonna need to fetch it again.
      db.set('rss:' + source, body);
      db.pexpire('rss:' + source, CACHE_TTL);
      res.end(body);
    });

  });
});


exports.name = "rss";
exports.app = app
