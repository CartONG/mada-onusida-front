/*eslint-env node*/
'use strict';

var _ = require('lodash');
var fs = require('fs');
var merge = require('merge-stream');
var browserSync = require('browser-sync');
var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();

var config = {
  locales: ['fr-FR', 'mg-MG'],
}

function templatesForLocale(locale, translations, isDefaultLocale) {
  return gulp.src(`src/index.template.html`)
    .pipe(plugins.template(translations, {
      interpolate: /\[translation\:([\s\S]+?)\]/g,
      evaluate: /(do_not_use)/g,
      escape: /(do_not_use)/g
    }))
    .pipe(plugins.rename(function (renamePath) {
      renamePath.basename = 'index';
      if (!isDefaultLocale) {
        renamePath.basename += `.${locale}`;
      }
    }))
    .pipe(gulp.dest('dist'));
}

gulp.task('templates', function () {
  var streams = merge();
  var defaultTranslations;

  config.locales.forEach(function(locale, index) {
    if (index === 0) {
      defaultTranslations = JSON.parse(fs.readFileSync(`./src/translations/${config.locales[0]}.json`, 'utf-8'));
    }
    var translations = JSON.parse(fs.readFileSync(`./src/translations/${locale}.json`, 'utf-8'));

    // only override translations of default locale that exist in the other locale
    var mergedTranslations = _.merge(_.clone(defaultTranslations), translations);
    streams.add(templatesForLocale(locale, mergedTranslations, index === 0));
  });

  return streams;
})

gulp.task('concatVendorCss', function() {
  return gulp.src([
    'node_modules/bootstrap/dist/css/bootstrap.min.css',
    'node_modules/bootstrap/dist/css/bootstrap-theme.min.css',
    'node_modules/leaflet/dist/leaflet.css',
    'node_modules/leaflet.markercluster/dist/leaflet.markercluster.css',
    'node_modules/leaflet.markercluster/dist/MarkerCluster.Default.css'
  ]).pipe(plugins.concat('vendors.css'))
  .pipe(gulp.dest('dist'))
})

gulp.task('concatVendorJs', function() {
  return gulp.src([
    'node_modules/jquery/dist/jquery.min.js',
    'node_modules/underscore/underscore-min.js',
    'node_modules/bootstrap/dist/js/bootstrap.min.js',
    'node_modules/leaflet/dist/leaflet.js',
    'node_modules/leaflet.markercluster/dist/leaflet.markercluster.js',
  ]).pipe(plugins.concat('vendors.js'))
  .pipe(gulp.dest('dist'))
})

gulp.task('copyAssets', function() {
  return gulp.src(['src/assets/**/*', 'node_modules/mada-front-common/assets/**/*'])
  .pipe(gulp.dest('dist/assets'))
})

gulp.task('serve', ['build'], function() {
  browserSync({
    server: {
      baseDir: './dist'
    },
    open: false,
    port: 3333
  });

  gulp.watch(['./src/*.html', './src/translations/*'], ['templates']);
  gulp.watch(['./src/assets/main.css'], ['copyAssets']);

  // only useful when working locally with npm link
  gulp.watch(['node_modules/mada-front-common/assets/**/*'], ['copyAssets']);

  gulp.watch('./dist/**/*', function () {
    browserSync.reload();
  });
});

gulp.task('build', ['templates','concatVendorCss','concatVendorJs','copyAssets']);

gulp.task('default', ['serve']);
