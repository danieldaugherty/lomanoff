
const cp = require('child_process');
const program = require('commander');
const Promise = require('bluebird');
const Lazy = require('lazy.js');
const fs = require('fs');

const writeFile = Promise.promisify(fs.writeFile);

program
    .option('-m --rent <min>', 'exclude all office space below this monthly rent', value => parseInt(value, 10), 1000)
    .option('-s --space <sqft>', 'exclude all office space below this square footage', value => parseInt(value, 10), 500)
    .parse(process.argv);

console.log('starting crawler with min rent', program.rent, 'and min square footage', program.space);

class Crawler {
    static baseSearchUrl = 'https://newyork.craigslist.org/search/mnh/off?availabilityMode=0&nh=120&nh=121&nh=122&nh=123&nh=124&nh=125&nh=126&nh=127&nh=128&nh=129&nh=130&nh=131&nh=132&nh=133&nh=134&nh=135&nh=136&nh=137&nh=160';
    static pageSize = 100;

    constructor(minPrice, minSpace) {
        this.minPrice = minPrice;
        this.minSpace = minSpace;
    }

    async start(timeout=10000) {
        let currentPage = 1;

        let pageUrls = Lazy
            .generate(() => {
                let params = {
                    s: Crawler.pageSize * currentPage,
                    min_price: this.minPrice,
                    minSqft: this.minSpace
                };
                const pageUrl = Crawler.baseSearchUrl + '&' + Object.keys(params).map(p => `${p}=${params[p]}`).join('&');
                ++currentPage;

                return pageUrl;
            })
            .take(100)
            .toArray();

        return Promise.resolve(pageUrls)
            .timeout(timeout)
            .map(async pageUrl => {
                let resolve;

                const promise = new Promise(res => {
                    resolve = res;
                });
                const childProcess = cp.fork('./scrapePage', ['-u', pageUrl]);

                childProcess.on('message', data => {
                    console.log('received data', typeof data, data);
                    childProcess.disconnect();
                    resolve(data);
                });

                childProcess.on('close', () => {
                    try {
                        resolve([]);
                    } catch (err) {
                        // do nothing
                    }
                });

                return promise;
            }, {concurrency: 3})
            .catch(err => {
                if (err instanceof Promise.TimeoutError) {
                    console.log('scraping timeout reached');
                    return;
                }
                throw err;
            })
            .reduce((flat, nested) => flat.concat(nested), [])
            .then(listings => {
                const fileContents = Lazy(listings)
                    .compact()
                    .sortBy('dollarsPerSquareFoot')
                    .map(l => `${l.dollarsPerSquareFoot},${l.rent},${l.space},${l.link}`)
                    .join('\n');
                return writeFile('output.txt', fileContents);
            })
            .catch(console.error);
    }
}

new Crawler(program.rent, program.space).start();