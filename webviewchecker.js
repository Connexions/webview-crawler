/**
 * This casper scipt checks for 404 internal links for a given root url.
 *
 * Usage:
 *
 *     $ casperjs webviewchecker.js http://mysite.tld/
 *     $ casperjs webviewchecker.js http://mysite.tld/ --max-depth=42
 */
 
/*global URI*/
 
var casper = require("casper").create({
    pageSettings: {
        loadImages: true,
        loadPlugins: false
    }
});
var checked = [];
var currentLink = 0;
var fs = require('fs');
var upTo = ~~casper.cli.get('max-depth') || 100;
var url = casper.cli.get(0);
var baseUrl = url;
var links = [url];
var utils = require('utils');
var f = utils.format;
 
function absPath(url, base) {
    return new URI(url).resolve(new URI(base)).toString();
}
 
// Clean links
function cleanLinks(urls, base) {
    return utils.unique(urls).filter(function(url) {
        return url.indexOf(baseUrl) === 0 || !new RegExp('^(#|ftp|javascript|http)').test(url);
    }).map(function(url) {
        return absPath(url, base);
    }).filter(function(url) {
        return checked.indexOf(url) === -1;
    });
}
 
// Opens the page, perform tests and fetch next links
function crawl(link) {
    this.start().then(function() {
        this.echo(link, 'COMMENT');
        this.open(link);
        checked.push(link);
    });
    this.then(function() {
        if (this.currentHTTPStatus === 404) {
            this.warn(link + ' is missing (HTTP 404)');
        } else if (this.currentHTTPStatus === 500) {
            this.warn(link + ' is broken (HTTP 500)');
        } else {
            this.echo(link + f(' is okay (HTTP %s)', this.currentHTTPStatus));
        }
    });
    this.then(function() {
        this.waitForSelector('div.logo', function then() {
            console.log('Connexions logo found!');
            this.wait(500, function() {
                this.capture('Connexions.png');
                console.log('Screenshot Connexions!');
                this.waitWhileSelector('div.progress.progress-striped.active', function then() {
                    console.log('Progressbar away');
                    this.wait(500, function() {
                        // sorry this is redundant for now with timeout... did know how to do it better for now.
                        var newLinks = searchLinks.call(this);
                        links = links.concat(newLinks).filter(function(url) {
                            return checked.indexOf(url) === -1;
                        });
                        this.echo(newLinks.length + " new links found on " + link);
                        var newImages = searchImages(this);
                        console.log(newImages);
                    });
                }, function timeout() {
                    console.log('Progressbar Timeout! :(');
                    this.capture('timeout.png');
                    var newLinks = searchLinks.call(this);
                    links = links.concat(newLinks).filter(function(url) {
                        return checked.indexOf(url) === -1;
                    });
                    this.echo(newLinks.length + " new links found on " + link);                    
                }, timeout=20000);
            });
        }, function timeout() { // step to execute if check has failed
            // this.echo("I can't haz my screenshot.").exit();
            console.log('Connexions logo Timeout! :(');
        });
    });
    // this.then(function() {
    //     var newLinks = searchLinks.call(this);
    //     links = links.concat(newLinks).filter(function(url) {
    //         return checked.indexOf(url) === -1;
    //     });
    //     this.echo(newLinks.length + " new links found on " + link);
    // });
}
 
// Fetch all <a> elements from the page and return
// the ones which contains a href starting with 'http://'
function searchLinks() {
    return cleanLinks(this.evaluate(function _fetchInternalLinks() {
        return [].map.call(__utils__.findAll('a[href]'), function(node) {
            return node.getAttribute('href');
        });
    }), this.getCurrentUrl());
}

function searchImages() {
    return cleanLinks(this.evaluate(function _fetchInternalLinks() {
        return [].map.call(__utils__.findAll('img[src]'), function(node) {
            return node.getAttribute('src');
        });
    }), this.getCurrentUrl());
}
 
// As long as it has a next link, and is under the maximum limit, will keep running
function check() {
    if (links[currentLink] && currentLink < upTo) {
        crawl.call(this, links[currentLink]);
        currentLink++;
        this.run(check);
    } else {
        this.echo("All done, " + checked.length + " links checked.");
        this.exit();
    }
}
 
if (!url) {
    casper.warn('No url passed, aborting.').exit();
}
 
casper.start('https://js-uri.googlecode.com/svn/trunk/lib/URI.js', function() {
    var scriptCode = this.getPageContent() + '; return URI;';
    window.URI = new Function(scriptCode)();
    if (typeof window.URI === "function") {
        this.echo('URI.js loaded');
    } else {
        this.warn('Could not setup URI.js').exit();
    }
});
 
casper.run(process);
 
function process() {
    casper.start().then(function() {
        this.echo("Starting");
    }).run(check);
}