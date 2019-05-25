'use strict';
/* global require, console, Buffer */
var streamy = require('streamy-data'),
	pesticide = require('./bin/pesticide'),
  PC = require('./bin/pesticide2'),
	util = require('./bin/util'),
	clone = util.clone,
	copyIfAbsent = util.copyIfAbsent,
	moa = require('./bin/zh-en-moa'),
	unorm = require('unorm'),
	gulp = require('gulp'),
	File = require('vinyl'),
	async = require('async'),
	fs = require('fs'),
  fsx = require('fs-extra'),
  r = require('ramda');

Error.stackTraceLimit = Infinity;

gulp.task('data.download', [
	'data.download.pesticide'
]);

function writeUsages(ids) {
  return new Promise(function (resolve, reject) {
    streamy.array(ids)
      // transform them into detailed data object from the website
      .pipe(streamy.map(pesticide.download.usage))
      // transform them into vinyl file format (to work with gulp.dest)
      .pipe(streamy.file.vinylify(function (data) {
        return './' + data.id + '.json';
      }, {
        stringify: { space: '\t' }
      }))
      // write file to specified destination
      .pipe(gulp.dest('./_raw/download/pesticide/usages'))
      .on('data', function () {})
      .on('end', function (err, res) {
        if (err) {
          return reject(err);
        }
        return resolve(res);
      });
  });
}

/* Utility functions for task: data.download.pesticide
 */
function delay(time) {
  return function(value) {
    return new Promise(resolve => setTimeout(resolve, time, value));
  }
}

function saveLicenses(licenses) {
  fsx.writeJson(
    './_raw/download/pesticide/licenses.json',
    licenses,
    { spaces: '  ' }
  );
  return licenses;
}

function saveEntry(entry) {
  fsx.writeJson(
    './_raw/download/pesticide/entries/' + entry.id + '.json',
    entry,
    { spaces: '  ' }
  );
  return entry;
}

function toIndexItem(entry) {
  return {
    id: entry.id,
    name: entry[PC.entryNameKey]
  };
}

function saveIndex(items) {
  fsx.writeJson(
    './_raw/download/pesticide/index.json',
    items,
    { spaces: '  ' }
  );
  return items;
}

/* This task shall write the following files:
 * + /_raw/download/pesticide/licenses.json
 * + /_raw/download/pesticide/index.json
 * + /_raw/download/pesticide/entries/{id}.json
 */
/* jshint asi: true */
gulp.task('data.download.pesticide', function (callback) {

  PC.getLicenses()
    .then(saveLicenses)
    .then(PC.groupByCodenames)
    .then(async codenameMap => {
      let items = [];
      for (let id of Object.keys(codenameMap)) {
        const licenses = codenameMap[id];
        try {
          const item = await PC.createEntry(id, licenses)
            .then(delay(500))
            .then(saveEntry)
            .then(toIndexItem);
          items.push(item);
        } catch (e) {
          console.error(e);
          console.log('missing usages: ' + id);
        }
      }
      saveIndex(items);
    })

});



/* In hopes of manually calling download tasks, we keep build tasks away from 
 * dependencies to them.
 */
gulp.task('data.build', [
	'data.build.pesticide',
	'data.build.formulations'
]);

/* Precondition: all downloaded raw files are available, which includes:
 * + /_raw/download/pesticide/licenses.json
 * + /_raw/download/pesticide/index.json
 * + /_raw/download/pesticide/entries/{id}.json
 *
 * This task shall write the following files:
 * + /_data/pesticide/list.json
 * + /_data/pesticide/entries/{id}.json
 * + /pesticide/entries/{id}.html
 * + /data/pesticide/usages-search.json
 */
function readAsString (filename, callback) {
	return fs.readFile(filename, 'utf8', callback);
}

gulp.task('data.build.pesticide', function (callback) {

	// callback is invoked when end is called three times
	var end = streamy.util.wait(4, callback);

	async.map(
		[
			'./_raw/download/pesticide/index.json',
			'./_raw/download/pesticide/licenses.json',
			'./_raw/tactri_moa_2014.txt'
		],
		readAsString,
		function (err, data) {

			var index = JSON.parse(data[0]),
				licenses = JSON.parse(data[1]),
				moaObj = moa(data[2]),
				m = {},
				usageSearchData = {};

			// initialize entry objects
			index.forEach(function (entry) {
				entry.licenses = [];
				m[entry.id] = entry;
			});

			async.series([
				function (cb) {
					fs.writeFile('./_data/pesticide/list.json', data[0], cb);
				},
				function (cb) {
					streamy.array(index.slice(0)) // TODO: stream array bug
						.pipe(streamy.map.sync(function (data) {
							return new File({
								path: './' + data.id + '.html',
								contents: new Buffer('---\nlayout: pesticide-entry\nid: ' + data.id + '\n---\n')
							});
						}))
						.pipe(gulp.dest('./pesticide/entries'))
						.on('data', function () {})
						.on('end', cb);
				},
				function (cb) {
					var usages = usageSearchData.usages = [],
						pesticideMap = usageSearchData.pesticides = {},
						id, entry;

					usageSearchData.corpMap = {};

          // include information from license data
          licenses.forEach(function(lic) {
            id = lic['農藥代號'];
            entry = m[id];

            if (!entry) return;

            copyIfAbsent(entry, lic, '英文名稱');
            // the composition ratio might be different per license
            //copyIfAbsent(entry, lic, '化學成分');

            entry.licenses.push({
              '許可證號': lic['許可證號'],
              '化學成分': lic['化學成分'],
              '廠牌名稱': lic['廠牌名稱'],
              '國外原製造廠商': lic['國外原製造廠商'],
              '有效期限': lic['有效期限'],
              '廠商名稱': lic['廠商名稱']
            });

          });

					// collect pesticide search: pesticide entries
					index.forEach(function (entry) {
						var products = {};
						entry.licenses.forEach(function (lic) {
							if (lic['廠牌名稱'])
								products[lic['廠牌名稱']] = 1;
						});
						pesticideMap[entry.id] = {
							id: entry.id,
							name: entry.name || '',
							engName: entry['英文名稱'] || '',
							products: Object.keys(products).join('#')
						};
					});

					// XXX: should ignore entries which are not in the index
					gulp.src(['./_raw/download/pesticide/entries/*'])
						.pipe(streamy.file.unvinylify())
						.on('data', function (data) {
							// merge into pesticide entries
							//console.log(data.id);
							//console.log(m[data.id]);
							var entry = m[data.id];
							if (!entry) return;

							var record = moaObj[unorm.nfc(entry.name)];

							if (record) {
								entry['作用機制'] = record
							} else {
								entry['作用機制'] = '-'
							}

							if (entry === undefined) {
								console.warn(
									'Should update',
									'`./_raw/download/pesticide/index.json`',
									'for ' + data.id + '.'
								);
								entry = data
							} else {
								copyIfAbsent(entry, data, '廠牌名稱');
								copyIfAbsent(entry, data, '通過日期');
								copyIfAbsent(entry, data, 'usages');
							}

							// collect pesticide search: usage entries
							data.usages.forEach(function (u) {
								var usage = clone(
									{
										pesticideId: data.id,
										'作用機制': entry['作用機制']
									},
									u
								);
								usages.push(usage);
							});
						})
						.on('end', function () {
							// TODO: write to _data/pestcide/entries/[id].json, replace gulp.dest('./pesticide')

							// write pesticide entry pages
							streamy.array(index)
								.pipe(streamy.map.sync(function (data) {
									return new File({
										path: './' + data.id + '.json',
										contents: new Buffer(JSON.stringify(data, null, '\t'))
									});
								}))
								.pipe(gulp.dest('./_data/pesticide/entries'))
								.on('data', function () {})
								.on('end', cb); // end 4
						});
				},
				function (cb) {
					// write usages-search.json
					fs.writeFile('./data/pesticide/usages-search.json',
						JSON.stringify(usageSearchData, null, '\t'), cb); // end 3
				}
			],
			function () {
				callback();
			});
		}
	);

});

/* Precondition: the following files are available:
 * + /_raw/manual/pesticide/fomulations.json
 *
 * This task shall write the following files:
 * + /_data/pesticide/formulations.json
 * + /data/pesticide/formulations.json
 */
gulp.task('data.build.formulations', function (callback) {

	// callback is invoked when end is called 2 times
	var success = callback.bind(this, null); // XXX: assume everything is fine
	var end = streamy.util.wait(2, success);

	fs.readFile('./_raw/manual/pesticide/formulations.json', 'utf8', function (err, data) {
		fs.writeFile('./_data/pesticide/formulations.json', data, end); // end 1
		fs.writeFile('./data/pesticide/formulations.json', data, end); // end 2
	});

});
