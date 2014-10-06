var path   = require('path');
var gulp   = require('gulp');
var less   = require('gulp-less');
var rename = require('gulp-rename');

gulp.task('compileall', function(){
  gulp.src('./static/**/css/*.less')
    .pipe(rename(function(path){
      path.extname = ".css";
    }))
    .pipe(less({ paths: [ /* Search paths for import directives */ ] }))
    .pipe(gulp.dest('./static'));
});

gulp.task('default', ['compileall'], function(){
  gulp.watch('./static/**/css/*.less', function(event){
    gulp.src(event.path)
      .pipe(rename(function(path){
        path.extname = ".css";
        path.dirname = "./";
      }))
      .pipe(less({ paths: [ /* Search paths for import directives */ ] }))
      
      .on('error', function(err){
        console.log(err);
      })

      .pipe(gulp.dest(path.dirname(event.path)));
  });
});
