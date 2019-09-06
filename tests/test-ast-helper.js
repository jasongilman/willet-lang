// FUTURE Write tests in willet.
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;
const astHelper = require('../lib/ast-helper');
const examples = require('./examples');

const visitor = (context, node) => node;

describe('walk', () => {
  for (const [exampleSetName, exampleSet] of _.toPairs(examples)) {
    describe(exampleSetName, () => {
      for (const { name, ast } of exampleSet) {
        it(`should prewalk ${name}`, async () => {
          const result = astHelper.prewalk({}, visitor, _.cloneDeep(ast));
          expect(result).to.deep.equal(ast);
        });

        it(`should postwalk ${name}`, async () => {
          const result = astHelper.postwalk({}, visitor, _.cloneDeep(ast));
          expect(result).to.deep.equal(ast);
        });
      }
    });
  }
});
