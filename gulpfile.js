/*eslint-env node*/
'use strict';

var _ = require('lodash');
var merge = require('merge-stream');
var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();

var config = {
  locales: ['fr-FR', 'mg-MG'],
}

function templatesForLocale(locale, translations, isDefaultLocale) {
  return gulp.src(`src/index.template.html`)
    .pipe(plugins.template(translations, {
      interpolate: /\[translation\:([\s\S]+?)\]/g,
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
      defaultTranslations = require(`./src/translations/${config.locales[0]}.json`);
    }
    var translations = require(`./src/translations/${locale}.json`);

    // only override translations of default locale that exist in the other locale
    var mergedTranslations = _.merge(_.clone(defaultTranslations), translations);
    streams.add(templatesForLocale(locale, mergedTranslations, index === 0));
  });

  return streams;
})
