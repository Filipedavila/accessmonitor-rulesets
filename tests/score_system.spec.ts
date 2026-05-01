import { generateScore, ScoreCalculators } from '../src/scoring';
import { ruleset } from '../src/tests-metadata';
import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../src/tests-metadata', () => ({
  ruleset: {
    'TEST_PROP': {
      type: 'prop',
      score: 10,
      trust: '1',
      dis: { '5': 1 }, // weight = 1 * 5 = 5
      elem: 'all_elements',
      test: 'error_elements'
    },
    'TEST_DECR': {
      type: 'decr',
      score: 10,
      trust: '0.8',
      dis: { '10': 1 }, // weight = 0.8 * 10 = 8
      top: 5,
      steps: 2,
      test: 'error_elements'
    },
    'TEST_BINARY': {
      type: 'true',
      score: 10,
      trust: '1',
      dis: { '2': 1 }, // weight = 1 * 2 = 2
      elem: 'all_elements'
    },
    'TEST_WARNING': {
      result: 'warning',
      type: 'true'
    }
  }
}));

describe('Scoring Engine - Unit Tests', () => {

  describe('ScoreCalculators', () => {
    
    it('proportional: should calculate correct score based on element ratio', () => {
      const rule = (ruleset as any)['TEST_PROP'];
      // Formula: 10 - (10 / 100) * 20 = 8
      const result = ScoreCalculators.proportional(rule, 100, 20);
      expect(result.score).toBe(8);
      expect(result.weight).toBe(5);
    });

    it('proportional: should never return a score lower than 1', () => {
      const rule = (ruleset as any)['TEST_PROP'];
      // Ratio would result in negative: 10 - (10/10) * 50 = -40
      const result = ScoreCalculators.proportional(rule, 10, 50);
      expect(result.score).toBe(1);
    });

    it('decrement: should apply penalties after the threshold (top)', () => {
      const rule = (ruleset as any)['TEST_DECR'];
      // Errors: 9. Threshold: 5. Excess: 4. Steps: 2. Penalty: 4/2 = 2.
      // Score: 10 - 2 = 8
      const result = ScoreCalculators.decrement(rule, 9);
      expect(result.score).toBe(8);
      expect(result.weight).toBe(8);
    });

    it('binary: should return the base score and calculate weight correctly', () => {
      const rule = (ruleset as any)['TEST_BINARY'];
      const result = ScoreCalculators.binary(rule);
      expect(result.score).toBe(10);
      expect(result.weight).toBe(2);
    });
  });

  describe('generateScore Function', () => {

    it('should return 10.0 if there are no applicable tests', () => {
      const report = {
        data: {
          tot: { results: {} },
          elems: {}
        }
      };
      expect(generateScore(report)).toBe("10.0");
    });

    it('should ignore rules marked as warning', () => {
      const report = {
        data: {
          tot: { results: { 'TEST_WARNING': 'something' } },
          elems: {}
        }
      };
      expect(generateScore(report)).toBe("10.0");
    });

    it('should calculate a weighted average for multiple rules', () => {
      // Mocking element counts for our rules
      const report = {
        data: {
          tot: { results: { 'TEST_PROP': '...', 'TEST_BINARY': '...' } },
          elems: {
            'all_elements': 100,
            'error_elements': 50 // 50% error on TEST_PROP -> score 5
          }
        }
      };

      /**
       * CALCULATION LOGIC:
       * 1. TEST_PROP: score 5, weight 5. Normalized weight = 1. Contribution = 5 * 1 = 5.
       * 2. TEST_BINARY: score 10, weight 2. Normalized weight = 0.4. Contribution = 10 * 0.4 = 4.
       * 
       * Result: (5 + 4) / (1 + 0.4) = 9 / 1.4 = ~6.4
       */
      const score = generateScore(report);
      expect(score).toBe("6.4");
    });

    it('should skip rules where the base element is missing and not a FALSE metric', () => {
      const report = {
        data: {
          tot: { results: { 'TEST_PROP': '...' } },
          elems: {
            // 'all_elements' is missing here
            'error_elements': 10
          }
        }
      };
      // totalWeightSum remains 0 because TEST_PROP was skipped
      expect(generateScore(report)).toBe("10.0");
    });

    it('should update the report results with the formatted score string', () => {
      const report = {
        data: {
          tot: { results: { 'TEST_BINARY': 'initial' } },
          elems: { 'all_elements': 1 }
        }
      };
      
      generateScore(report);
      
      // Expected: "score@contribution"
      // score=10, weight=2, normalized=0.4, contrib=4.00
      expect(report.data.tot.results['TEST_BINARY']).toBe("10@4.00");
    });
  });
});