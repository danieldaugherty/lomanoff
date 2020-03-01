# lomanoff
Craigslist Scraper for Office Space in Lower Manhattan

## Just a Demo
This was created to show off the capabilities of Node.js and packages in its ecosystem. It uses commander, Lazy.js, cheerio, bluebird, and a promisified version of request.

## Two Implementations

### index.js
A straightforward Craigslist scraper CLI script. Hard-coded to search lower-manhattan neighborhoods for office space. Accepts parameters for rent and square footage.

### index-cp.js
The same as index.js, except it uses child processes to do the scraping. The child processes run the scrapePage module.

## Usage
Run the index file of your choosing.
```bash
node index.js
```

By default, the script will look for space with a minimum $1000 rent, and 500 sqft. To specify different minimum values, run the script like so:
```bash
node index.js --space 1000 --rent 3000
```

## System Dependencies
- Node 12+