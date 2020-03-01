
const program = require('commander');
const cheerio = require('cheerio');
const Promise = require('bluebird');
const Lazy = require('lazy.js');
const fs = require('fs');
const request = require('request-promise');

const writeFile = Promise.promisify(fs.writeFile);

program
    .option('-r --rent <rent>', 'exclude all office space below this monthly rent', value => parseInt(value, 10), 1000)
    .option('-s --space <sqft>', 'exclude all office space below this square footage', value => parseInt(value, 10), 500)
    .parse(process.argv);

console.log('starting crawler with min rent', program.rent, 'and min square footage', program.space);

class Scraper {
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
                const html = await request.get(pageUrl);

                let $ = cheerio.load(html);

                const listingElems = $('li.result-row').toArray();

                return listingElems
                    .map(elem => {
                        const info = elem.children.find(this.getChildByClassName('result-info'));
                        const meta = info && info.children.find(this.getChildByClassName('result-meta'));
                        const price = meta && meta.children.find(this.getChildByClassName('result-price'));
                        const housing = meta && meta.children.find(this.getChildByClassName('housing'));
                        const link = elem.children.find(this.getChildByClassName('result-image'));

                        if (!info || !meta || !price || !housing || !link) return null;

                        const listing = {
                            rent: parseInt(Scraper.getText(price).trim().substr(1), 10).toFixed(2),
                            space: parseInt(Scraper.getText(housing), 10),
                            link: link.attribs && link.attribs.href && link.attribs.href.trim()
                        };

                        if (!listing.rent || !listing.space || !listing.link) return null;

                        listing.dollarsPerSquareFoot = (listing.rent / listing.space).toFixed(2);

                        return listing;
                    });
            }, {concurrency: 4})
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

    getChildByClassName(className) {
        return child => child.type === 'tag' && child.attribs.class && child.attribs.class.match(className);
    }

    static getText(elem) {
        return elem.children &&
            elem.children.filter(ch => ch.type === 'text')
                .map(ch => ch.data)
                .join('');
    }
}

new Scraper(program.rent, program.space).start();