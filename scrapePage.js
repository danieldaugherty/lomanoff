
const request = require('request-promise');
const program = require('commander');
const cheerio = require('cheerio');

program
    .requiredOption('-u --url <url>', 'page url to scrape')
    .parse(process.argv);

async function scrape(pageUrl) {
    const html = await request.get(pageUrl);

    let $ = cheerio.load(html);

    const listingElems = $('li.result-row').toArray();

    const listings = listingElems
        .map(elem => {
            const info = elem.children.find(getChildByClassName('result-info'));
            const meta = info && info.children.find(getChildByClassName('result-meta'));
            const price = meta && meta.children.find(getChildByClassName('result-price'));
            const housing = meta && meta.children.find(getChildByClassName('housing'));
            const link = elem.children.find(getChildByClassName('result-image'));

            if (!info || !meta || !price || !housing || !link) return null;

            const listing = {
                rent: parseInt(getText(price).trim().substr(1), 10).toFixed(2),
                space: parseInt(getText(housing), 10),
                link: link.attribs && link.attribs.href && link.attribs.href.trim()
            };

            if (!listing.rent || !listing.space || !listing.link) return null;

            listing.dollarsPerSquareFoot = parseFloat((listing.rent / listing.space).toFixed(2));

            return listing;
        });

    process.send(listings);
}

function getChildByClassName(className) {
    return child => child.type === 'tag' && child.attribs.class && child.attribs.class.match(className);
}

function getText(elem) {
    return elem.children &&
        elem.children.filter(ch => ch.type === 'text')
            .map(ch => ch.data)
            .join('');
}


scrape(program.url);