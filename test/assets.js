// Native imports
var fs = require('fs');
var path = require('path');

// Vendor imports
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var postcss = require('postcss');

// Local imports
var plugin = require('..');

var expect = require('chai').expect;
chai.use(chaiAsPromised);

function fixture(name) {
  return 'test/fixtures/' + name + '.css';
}

function readFixture(name) {
  return new Promise(function(resolve, reject) {
    fs.readFile(fixture(name), 'utf8', function(err, data) {
      if (err) return reject(err);
      resolve(data.trim());
    });
  });
}

function processFixture(name, options, postcssOptions) {
  return new Promise(function(resolve, reject) {
    readFixture(name)
      .then(function(css) {
        postcss()
          .use(plugin(options))
          .process(css, postcssOptions)
          .then(function(result) {
            resolve(result.css.trim());
          }, reject);
      });
  });
}

function test(name, options, postcssOptions) {
  return function(done) {
    processFixture(name, options, postcssOptions)
      .then(function(actualResult) {
        readFixture(name + '.expected')
          .then(function(expectedResult) {
            expect(actualResult).to.equal(expectedResult);
            done();
          });
      });
  };
}

function modifyFile(pathString) {
  return new Promise(function(resolve, reject) {
    fs.stat(pathString, function(err, stats) {
      if (err) return reject(err);
      var atime = stats.atime;
      var mtime = new Date();
      fs.utimes(pathString, atime, mtime, function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

describe('plugin', function() {
  it('should have a postcss method for a PostCSS Root node to be passed', function(done) {
    readFixture('resolve')
      .then(function(css) {
        postcss()
          .use(plugin.postcss)
          .process(css)
          .then(function(result) {
            var actualResult = result.css.trim();
            readFixture('resolve.expected')
              .then(function(expectedResult) {
                expect(actualResult).to.equal(expectedResult);
                done();
              });
          });
      });
  });

  it('should throw an error when something goes wrong', function() {
    return expect(processFixture('resolve', {
      cachebuster: 'this should crash plugin',
    })).to.eventually.be.rejected;
  });
});

describe('resolve', function() {
  it('should resolve paths', test('resolve'));

  it('should resolve relative to the base path', test('resolve-basepath', {
    basePath: 'test/fixtures',
  }));

  it('should resolve relative to the load paths', test('resolve-loadpath', {
    basePath: 'test/fixtures',
    loadPaths: ['alpha/', 'beta/'],
  }));

  it('should resolve relative to the load paths of a funky spelling', test('resolve-loadpath', {
    basePath: 'test/fixtures',
    loadPaths: ['./alpha/', 'beta'],
  }));

  it('should resolve relative to the base URL', test('resolve-baseurl', {
    basePath: 'test/fixtures',
    baseUrl: '/content/theme/',
  }));

  it('should resolve relative to the base URL respecting domain', test('resolve-baseurl-domain', {
    basePath: 'test/fixtures',
    baseUrl: 'http://example.com',
  }));

  it('should resolve from source file location', test('resolve-from-source', {
    basePath: 'test',
    loadPaths: ['fixtures/alpha'],
  }, {
    from: fixture('resolve-from-source'),
  }));

  it('should resolve relative paths', test('resolve-relative-to', {
    basePath: 'test/fixtures/alpha',
    relativeTo: 'test/fixtures/beta',
  }));

  it('should recognize funky spelling', test('resolve-spelling', {
    basePath: 'test/fixtures',
    loadPaths: ['alpha/'],
  }));

  it('should throw an error when an asset is unavailable', function() {
    return expect(processFixture('resolve-invalid')).to.eventually.be.rejectedWith('Asset not found or unreadable');
  });

  it('should bust cache', function(done) {
    var options = {
      cachebuster: true,
      loadPaths: ['test/fixtures/alpha/'],
    };

    processFixture('resolve-cachebuster', options)
      .then(function(resultA) {
        modifyFile('test/fixtures/alpha/kateryna.jpg')
          .then(function() {
            processFixture('resolve-cachebuster', options)
              .then(function(resultB) {
                expect(resultA).to.not.equal(resultB);
                done();
              });
          });
      });
  });

  it('should accept custom buster function returning a string', test('resolve-cachebuster-string', {
    cachebuster: function() {
      return 'cachebuster';
    },
    loadPaths: ['test/fixtures/alpha/'],
  }));

  it('should accept custom buster function returning an object', test('resolve-cachebuster-object', {
    cachebuster: function(filePath, urlPathname) {
      var filename = path.basename(urlPathname, path.extname(urlPathname)) + '.cache' + path.extname(urlPathname);
      return {
        pathname: path.dirname(urlPathname) + '/' + filename,
        query: 'buster',
      };
    },
    loadPaths: ['test/fixtures/alpha/'],
  }));

  it('should accept custom buster function returning a falsy value', test('resolve-cachebuster-falsy', {
    cachebuster: function() {
      return;
    },
    loadPaths: ['test/fixtures/alpha/'],
  }));
});

describe('inline', function() {
  it('should base64-encode assets', test('inline', {
    basePath: 'test/fixtures/',
  }));
});

describe('width, height and size', function() {
  it('should resolve dimensions', test('dimensions', {
    basePath: 'test/fixtures/',
  }));

  it('should throw an error when an image is corrupted', function() {
    return expect(processFixture('dimensions-invalid')).to.eventually.be.rejectedWith('Image corrupted');
  });
});
