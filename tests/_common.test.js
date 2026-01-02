import { describe, it, expect } from 'vitest';
import { isManifestPath, isSummaryPath } from 'src/_data/_common.js';
import { Stages } from 'src/_data/stages.js';

describe('isManifestPath', () => {
  it('should correctly identify manifest paths', () => {
    const testCases = [
      // [filepath, expectedResult]
      [`documents/${Stages.META}/company-a/policy-1/manifest.json`, true],
      // Add more test cases here
    ];

    testCases.forEach(([filepath, expected]) => {
      expect(isManifestPath(filepath), `Failed for filepath: "${filepath}"`).toBe(expected);
    });
  });
});

describe('isSummaryPath', () => {
  it('should correctly identify summary paths', () => {
    const testCases = [
      // [filepath, expectedResult]
      [`documents/${Stages.SUMMARY_CLEAN}/company-a/policy-1/12345/latest.json`, true],
      [`documents/${Stages.SUMMARY_CLEAN}/company-a/policy-1/12345/ABCDE.json`, false],
      [`documents/${Stages.SUMMARY_CLEAN}/company-a/policy-1/12345.json`, false],
      [`documents/${Stages.SUMMARY_RAW}/company-a/policy-1/12345/latest.json`, false],
      [`documents/${Stages.SUMMARY_RAW}/company-a/policy-1/12345/ABCDE.json`, false],
      [`documents/${Stages.SUMMARY_RAW}/company-a/policy-1/12345.json`, false],
      
      // Add more test cases here
    ];

    testCases.forEach(([filepath, expected]) => {
      expect(isSummaryPath(filepath), `Failed for filepath: "${filepath}"`).toBe(expected);
    });
  });
});
