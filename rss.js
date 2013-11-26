/**
 * RSS Module
**/
var connect = require('connect');
var _ = require('underscore');
var app = connect();


app.use('/widget', function(req, res, next){
  // RSS Widget parameters
  var source = req.body.source;
  var count  = req.body.count;
  var id     = req.body.id;
  
  // Check if the widget already exists
  var widgets = req.user.widgets;
  var exists  = id && _.find(widgets, function(w){ id === w.id; });
  
  // If exists, update it
  if(exists) {
    exists.count = count;
    exists.source = source;
  }

  // If not push make a new one
  else {
    id = widgets.length && _.max(_.pluck(widgets, 'id')) + 1;
    req.user.widgets.push({
      id: id,
      source: source,
      count: count,
      module: 'rss'
    });
  }
  
  // Set the response body
  res.body = { status: 'ok', id: id };
  next();
});

// Fetches a feed from its source, or retrieve's it from the cache
app.use('/feed', function(req, res, next){
  res.end("");
});


exports.name = "rss";
exports.app = app
