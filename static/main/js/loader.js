/**
 * Mini async script loader.
 * Puts a function named `require` in the window namespace.
 * Usage:

     require('/script_1.js', 'script_2.js', ['dependancy_1.js', 'dependee_1.js'], function(){
       // Do something once done.
     });
 
 * The `require` function accepts strings and arrays. The last argument can be a callback.
 * Strings are loaded in parallel. Arrays of strings are loaded in succession (these are good for dependencies).
 * 
**/
(function (){
  function load(src, fn){
    var script    = document.createElement('script');
    script.type   = 'text/javascript';
    script.async  = true;
    script.src    = src;
    script.onload = script.onreadystatechange = function() {
      if (!script.readyState || (script.readyState === 'complete' || script.readyState === 'loaded')) {
        script.onload = script.onreadystatechange = null;
        return fn();
      }
      alert("A server error happened."); 
    };
    document.head.appendChild(script);
  }

  window.require = function(){
    var arg, i=0, callback = arguments[arguments.length - 1];

    (typeof callback !== 'function') && (callback = {});
    (callback.loading === undefined) && (callback.loading = 0);

    function done(){
      --callback.loading === 0 && typeof callback === 'function' && callback();
    }

    while(arg = arguments[i++]){
      // Strings are loaded asynchronously
      if(typeof arg === 'string') {
        callback.loading++;
        load(arg, done);
      }

      // Arrays of strings are loaded in succession because they depend on each other
      else if(typeof arg === 'object' && typeof arg.pop === 'function') {
        (function(arg){
          var next = arg.shift();
          if(!next) return done();

          ++callback.loading;
          load(next, function(){
            if( arg.length ) --callback.loading; // Decrement loading since we're not calling done() yet
            require(arg, callback);
          });
        })(arg.slice());
      }
    }
  }
})();
