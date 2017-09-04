const { writeFileSync } = require('fs');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { pipe, trim, tap, identity } = require('ramda');
const yargs = require('yargs')
  .option('letters', {
    type: 'array',
    describe: 'Letters to crawl',
    demandOption: false,
    default: 'abcdefghijklmnopqrstuvwxyz'.split('')
  })
  .option('debug', {
    type: 'boolean',
    descibe: 'Debugging enabled',
    demandOption: false,
    default: false
  })
  .help()
  .argv;

const { letters, debug } = yargs;

const getParentText = elem => elem
  .clone()    //clone the element
  .children() //select all the children
  .remove()   //remove all the children
  .end()  //again go back to selected element
  .text();

const indexOfOrInfinity = (text, test) => text.indexOf(test) > -1 ? text.indexOf(test) : Number.MAX_VALUE;
const firstBadChar = text => Math.min(indexOfOrInfinity(text, '('), indexOfOrInfinity(text, '\n'))
const upToFirstWhitespace = text => text.substring(0, firstBadChar(text));
const removeDuplicateWhitespace = text => text.replace(/\s+/g, ' ')
const removeNewLines = text => text.replace(/\s/gi, ' ')

const log = debug ? tap(console.log) : tap(identity)
const treatText = pipe(log, removeNewLines, log, removeDuplicateWhitespace, log, upToFirstWhitespace, log, trim, log);

(async () => {

  let result = [];

  await letters.reduce(async (previous, letter) => {
    await previous;
    console.log(`Getting letter: ${letter}`)

    const response = await fetch(`http://glossairedusocial.fr/index.php?lettre=${letter}`);
    const text = await response.text();

    const $ = cheerio.load(text);
    const rows = $('table > tbody > tr');

    rows.each(function (i, elem) {
      const row = $(this);
      const is_advert = row.find('script').length > 0;

      if(is_advert) {
        return;
      }

      const abbreviation_text = getParentText(row.find('th > a'));
      const full_text_text = getParentText(row.find('td').eq(0));

      const abbreviation = treatText(abbreviation_text);
      const full_text = treatText(full_text_text);

      if(debug) {
        console.log(`[${abbreviation}] - ${full_text}
          [${abbreviation_text}] - ${full_text_text}`)
      }

      result.push([abbreviation, full_text]);
    });
  }, Promise.resolve());

  writeFileSync(`./out.json`, JSON.stringify(result, null, 2));
})();
